import type { NextFunction, Request, Response } from 'express';
import type { AppEnvironment } from '../config/env.js';

export interface SecurityOptions {
  allowedOrigins: readonly string[];
  enforceHttps: boolean;
  canonicalUrl?: string;
  environment: AppEnvironment;
}

const allowedMethods = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const allowedHeaders = 'Content-Type,Authorization,X-User-Id,X-Household-Id';
const productionContentSecurityPolicy = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const developmentContentSecurityPolicy = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss: https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

export function securityMiddleware(options: SecurityOptions) {
  const origins = new Set(options.allowedOrigins);
  const contentSecurityPolicy = options.environment === 'development'
    ? developmentContentSecurityPolicy
    : productionContentSecurityPolicy;
  return (req: Request, res: Response, next: NextFunction): void => {
    res.set({
      'Content-Security-Policy': contentSecurityPolicy,
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()'
    });
    if (options.enforceHttps) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    const forwardedProtocol = req.header('x-forwarded-proto')?.split(',')[0]?.trim();
    if (options.enforceHttps && forwardedProtocol && forwardedProtocol !== 'https') {
      if (!options.canonicalUrl) {
        res.status(400).json({ error: 'URL canonica nao configurada.' });
        return;
      }
      const target = new URL(req.originalUrl, options.canonicalUrl).toString();
      res.redirect(308, target);
      return;
    }

    const origin = req.header('origin');
    if (origin && origins.has(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Credentials', 'true');
      res.set('Access-Control-Allow-Methods', allowedMethods);
      res.set('Access-Control-Allow-Headers', allowedHeaders);
      res.vary('Origin');
    } else if (origin && req.path.startsWith('/api/')) {
      res.status(403).json({ error: 'Origem nao autorizada.' });
      return;
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  };
}
