# Release Checklist

## Preparação

- [ ] `backend/.env` criado a partir de `backend/.env.example` e revisado para produção.
- [ ] `.env.release` criado a partir de `.env.release.example` com nomes de imagem, tags e URLs públicas corretas.
- [ ] `JWT_SECRET` definido com pelo menos 32 caracteres.
- [ ] `CORS_ORIGIN` revisado para os domínios reais do frontend.
- [ ] `DOCKER_SOCKET_PATH` validado no host de deploy.
- [ ] `APP_VERSION` e `APP_COMMIT_SHA` alinhados com a release.

## Validação pré-release

- [ ] `cd frontend && npm run verify`
- [ ] `cd backend && python -m unittest discover -s tests -v`
- [ ] `docker compose up -d --build`
- [ ] `node scripts/smoke-test.mjs` executado com sucesso contra a stack publicada.

## Publicação

- [ ] workflow `Backend CI/CD` publicou `containermaster-backend`.
- [ ] workflow `Frontend CI/CD` publicou `containermaster-frontend-web`.
- [ ] imagens corretas estão referenciadas em `.env.release`.

## Deploy

- [ ] `./scripts/deploy-release.sh` executado no host de destino.
- [ ] `docker compose -f docker-compose.release.yml ps` mostra backend e frontend ativos.
- [ ] backend responde em `/health`.
- [ ] frontend responde em `/`.

## Observabilidade e pós-deploy

- [ ] logs do backend estão em `LOG_FORMAT=json` no ambiente de produção.
- [ ] respostas HTTP incluem `X-Request-ID`.
- [ ] `/health` expõe `service`, `environment`, `version` e `commitSha`.
- [ ] métricas principais do dashboard, logs e terminal foram testadas manualmente após deploy.
