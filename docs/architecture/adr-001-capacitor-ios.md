# ADR-001 — Aplicativo iOS: PWA agora, Capacitor após os gates

- **Data:** 3 de setembro de 2026
- **Status:** aceita, com adoção do Capacitor adiada
- **Escopo:** empacotamento iOS da aplicação React existente

## Decisão executiva

O Capacitor traz benefício real para câmera, biometria, Keychain, notificações e distribuição privada pelo TestFlight. Mesmo assim, **não será adicionado nesta entrega**. A aplicação ainda usa autenticação demonstrativa por seleção de usuário, a persistência principal é volátil, o fluxo OCR não está na navegação principal e não existe ambiente HTTPS de staging validado. Criar agora um binário nativo aumentaria a superfície de segurança e manutenção sem produzir um aplicativo financeiro publicável.

A PWA permanece como canal de homologação no iPhone. Capacitor é a direção aprovada para uma etapa posterior, sem reescrever React, condicionada aos gates deste documento. Esta decisão evita dependências e projetos Xcode ociosos e não autoriza TestFlight nem App Store.

## Diagnóstico observado

- A interface já é React/TypeScript, mobile-first, usa safe areas e possui manifest/service worker. Isso permite validar os fluxos e o layout no Safari instalado antes de manter um shell nativo.
- O service worker exclui `/api` do cache. Dados financeiros e respostas OCR, portanto, não são persistidos pelo cache da PWA.
- A API do Gemini fica no servidor. Esse limite deve ser preservado: `GEMINI_API_KEY`, credenciais Supabase privilegiadas e demais segredos nunca devem entrar no bundle web ou iOS.
- A autenticação atual escolhe um usuário conhecido e envia seu identificador em headers; ainda não há sessão Supabase/OIDC adequada para proteger e renovar no Keychain.
- O OCR de recibos aceita imagem e o de faturas aceita PDF, mas o gerenciador correspondente não faz parte da navegação principal. O upload usa `FileReader`, caminho compatível com o seletor web, sem uma abstração de captura nativa.
- A persistência principal ainda é em memória e a documentação operacional já bloqueia staging/produção por esse motivo.

## Comparação PWA × Capacitor

| Capacidade | PWA no iPhone | Capacitor no iPhone | Decisão |
|---|---|---|---|
| Notificações | Web Push atende iOS instalado, mas depende da versão/configuração do sistema e tem UX menos previsível. | APNs por plugin oferece ciclo de permissão, token e tratamento foreground/background mais controlados. Exige backend de registro/revogação e credenciais APNs fora do app. | Não implementar até existir caso de uso, consentimento e backend. Notificações financeiras não devem revelar valores na tela bloqueada por padrão. |
| Câmera/OCR | `<input type="file" accept="image/*" capture>` é suficiente para validar captura/upload; controle de lente e qualidade é limitado. | Plugin Camera melhora origem, qualidade, orientação e consistência. A imagem pode ser mantida apenas em memória e enviada à API existente. | Principal benefício nativo. Fazer um spike depois que o OCR estiver acessível e staging existir. |
| Biometria | Não oferece desbloqueio local arbitrário; WebAuthn/passkeys podem autenticar no servidor. | LocalAuthentication permite Face ID/Touch ID para reabrir sessão, mas não substitui autenticação nem autorização no servidor. | Só depois de sessões reais; biometria protege o acesso ao token no Keychain, não regras financeiras. |
| Armazenamento seguro | Web storage não é indicado para refresh tokens ou segredos. Cookies `HttpOnly`, `Secure`, `SameSite` são preferíveis na PWA. | Keychain é apropriado para refresh token/identificador de sessão. Preferences/localStorage não são cofres. | Não há hoje token sensível a migrar. Introduzir uma interface de sessão quando Supabase Auth for implementado. |
| Atualização | Deploy web imediato e service worker com aviso; exige cuidado com compatibilidade entre shell e API. | Código nativo passa por TestFlight/App Review. Atualização remota do bundle tem restrições e não deve contornar review. Conteúdo hospedado continua atualizável quando o shell aponta para HTTPS. | PWA acelera homologação. Releases nativas devem ser versionadas e promovidas pelo TestFlight. |
| Distribuição | URL privada e “Adicionar à Tela de Início”; sem revisão da Apple. | TestFlight facilita instalação controlada e feedback; App Store melhora descoberta, confiança e recursos nativos, com obrigações de privacidade. | TestFlight somente após os gates. App Store requer autorização explícita separada. |
| Deep links | Universal Links podem abrir o site; dependem de `apple-app-site-association`. | Universal Links e custom scheme podem encaminhar ao React Router. O custom scheme não deve carregar token sensível. | Reservar domínio/rotas primeiro; preferir Universal Links. |

## Arquitetura alvo, sem reescrita

Quando os gates forem atendidos, a aplicação React compilada continuará sendo a única interface. O projeto Capacitor será apenas um adaptador de plataforma:

1. `src/platform/` expõe contratos TypeScript para câmera, ciclo de vida, deep links, biometria e cofre de sessão. A implementação web preserva a PWA; a implementação nativa importa plugins somente nesse limite.
2. O shell usa artefatos locais de `dist/` em produção. `server.url` é permitido apenas no desenvolvimento/staging controlado, nunca como atalho para publicar uma WebView remota sem revisão.
3. Todo OCR continua em `POST /api/.../ocr/*`; o dispositivo envia imagem/PDF somente após confirmação. Não gravar fotos na galeria, Files, logs, analytics ou cache.
4. Gemini e acesso privilegiado ao Supabase permanecem exclusivamente no Node/Express. O app recebe apenas configuração pública mínima e sessão curta.
5. PostgreSQL/Supabase é a persistência canônica. Plugins locais podem guardar preferências não financeiras; não criam um segundo ledger offline.
6. Universal Links chegam a uma allowlist de rotas. IDs recebidos são revalidados no servidor contra casa e membro autenticados.

## Gates obrigatórios antes de `@capacitor/*`

- [ ] Substituir a persistência em memória por PostgreSQL/Supabase transacional, aplicar RLS e validar as regras contábeis automatizadas.
- [ ] Implementar autenticação real, expiração/revogação de sessão e autorização server-side; definir exatamente qual token irá ao Keychain.
- [ ] Disponibilizar o OCR na navegação e concluir o fluxo web de captura, limite de 10 MB, revisão humana e descarte da imagem.
- [ ] Publicar staging privado HTTPS e validar API, CORS, CSP e política de retenção com dados sintéticos.
- [ ] Definir casos de uso de notificação, preferências/consentimento e conteúdo seguro para lock screen.
- [ ] Definir bundle id definitivo, domínio de Universal Links e responsável pela conta Apple Developer.
- [ ] Aprovar política de privacidade, termos e exclusão de conta/dados.
- [ ] Disponibilizar macOS com Xcode suportado e ao menos um iPhone físico para CI/manual QA.

## Plano de implementação após os gates

1. Instalar versões fixadas e compatíveis de `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, Camera, App e Splash Screen; adicionar apenas o plugin biométrico/Keychain escolhido após revisão de manutenção e segurança.
2. Criar `capacitor.config.ts` com `appId`, `appName: "Casa Finance"`, `webDir: "dist"`, scheme HTTPS e allowlist mínima. Gerar `ios/` via CLI, sem editar dependências vendorizadas.
3. Adicionar ícones PNG opacos no Asset Catalog e splash screen sem informações financeiras. Validar claro/escuro, Dynamic Type, VoiceOver, portrait e safe areas em modelos com notch/Dynamic Island.
4. Declarar somente `NSCameraUsageDescription` inicialmente. Adicionar Face ID ou Photos apenas quando o respectivo fluxo existir; preferir câmera sem permissão ampla à biblioteca.
5. Implementar captura como bytes/base64 efêmeros, validar MIME/tamanho antes do upload, remover metadados quando possível e limpar referências depois de sucesso, erro ou cancelamento.
6. Servir `/.well-known/apple-app-site-association` sem redirect, associar o domínio e testar Universal Links. Nunca transportar access/refresh token na URL.
7. Guardar apenas refresh token ou envelope de sessão no Keychain com acessibilidade “após primeiro desbloqueio, somente neste dispositivo”; limpar em logout, revogação e exclusão da conta. Não guardar saldos, OCR ou chaves de servidor.
8. Tratar pausa/retorno com bloqueio por biometria configurável e fallback seguro para reautenticação. Operações continuam exigindo autorização no backend.
9. Criar testes unitários dos adaptadores, integração do upload e deep links, e E2E em simulador; câmera, biometria, notificações e Keychain precisam de evidência em iPhone físico.

## TestFlight antes da App Store

1. Inscrever a organização/pessoa responsável no Apple Developer Program, concluir contratos e habilitar 2FA. Certificados, App Store Connect API key e credenciais APNs ficam no cofre da CI, nunca no Git.
2. Registrar App ID/bundle id e o app no App Store Connect; configurar Signing & Capabilities mínimas e perfis por ambiente.
3. Arquivar uma build de staging sem chaves de servidor, enviar primeiro a **Internal Testing**, anexar notas e executar o roteiro abaixo com dados sintéticos.
4. Somente após aceite interno, avaliar External Testing e fornecer as informações de Beta App Review. Corrigir crashes, tratamento de permissão negada e exclusão de dados antes de solicitar review público.
5. Preparar ficha de privacidade/App Privacy com coleta, finalidade, retenção e vínculo à identidade; publicar a URL da política de privacidade.
6. **Não submeter à App Store sem autorização explícita.** Aprovar também nome, screenshots, classificação etária, suporte e respostas de criptografia/export compliance.

## Privacidade e exclusão de conta

A política pública deve identificar controlador e contato, dados financeiros/OCR coletados, finalidade, base legal aplicável, subprocessadores (incluindo Supabase e Gemini), países/transferências, retenção, segurança, direitos do titular e processo de incidente. Imagens OCR devem ter a menor retenção possível e nunca ser usadas para treinamento sem consentimento específico.

O app deve oferecer “Excluir conta” em local acessível. O backend autentica novamente, mostra impactos, revoga sessões/push tokens, agenda ou executa remoção de perfil, documentos OCR e dados pessoais, e entrega confirmação. Dados financeiros compartilhados cuja retenção seja necessária devem ser anonimizados ou mantidos com fundamento e prazo documentados, preservando a consistência do ledger dos demais membros. A exclusão não pode ser apenas um e-mail sem justificativa operacional aprovada.

## Roteiro de validação funcional nativa

- Instalação/upgrade pelo TestFlight e inicialização fria/quente sem tela branca.
- Login, logout, expiração e revogação; confirmar limpeza do Keychain e bloqueio de acesso entre casas.
- Permissão de câmera permitida, negada e posteriormente alterada em Ajustes.
- Foto de recibo sintético em diferentes orientações; validar MIME/tamanho, upload, revisão, confirmação e descarte local.
- Upload de PDF pelo seletor; testar arquivo inválido, acima de 10 MB, offline, timeout e retomada.
- Confirmar que logs, crash reports, clipboard, backups e notificações não contêm documento, token, descrição ou valor.
- Deep link com app fechado/aberto, rota inválida e objeto de outra casa.
- Face ID/Touch ID com sucesso, falha, cancelamento, indisponibilidade e alteração de biometrias.
- Regressão contábil: transferência neutra, compra no cartão sem débito bancário, pagamento de fatura sem nova despesa e acertos realizado/projetado.
- VoiceOver, Dynamic Type, teclado, contraste, safe areas e conectividade degradada em iPhone físico.

## Riscos e consequências

- Adiar Capacitor mantém limitações de integração da PWA, mas evita apresentar como seguro/publicável um app ainda demonstrativo.
- A futura adoção cria uma matriz web/iOS, dependência de plugins e processo Apple; contratos de plataforma e testes reduzem divergência.
- Keychain e biometria elevam a proteção local, porém dispositivo comprometido e sessão roubada continuam exigindo revogação e controles no servidor.
- Câmera nativa melhora o OCR, mas amplia obrigações de permissão e privacidade. A revisão humana permanece obrigatória; OCR nunca lança automaticamente uma movimentação.

