# Cronômetro Sincronizado — PWA

App de cozinha com levas paralelas de cronômetros sincronizados: todos os itens de uma leva terminam ao mesmo tempo.

## Como funciona

- **Cadastro**: adicione itens com nome, tempo (min + seg) e flag *split*
- **Board de preparo**: selecione itens para a próxima leva
- **Levas**: ao iniciar, o total é o maior tempo; cada item começa em `total − tempoItem`
- **Som**: bipe ao iniciar cada item, no split (metade) e ao término da leva
- **Paralelo**: várias levas rodam simultaneamente com controles independentes
- **Persistência**: estado salvo em `localStorage` (chave `cron-sincronizado:v3`)
- **PWA**: instalável na tela inicial, funciona offline (service worker via `vite-plugin-pwa`)

## Desenvolvimento local

```bash
npm install
npm run dev
```

Para testar o service worker (PWA offline):

```bash
npm run build
npm run preview
```

## Ícones PWA

Coloque os arquivos `public/icon-192.png` e `public/icon-512.png` antes do build.

## Stack

- React 18 + Vite 6
- vite-plugin-pwa (Workbox, autoUpdate)
- Web Audio API (sem dependências externas de áudio)
- CSS-in-JS inline (sem frameworks CSS)
