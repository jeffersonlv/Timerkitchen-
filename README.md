# Cronômetro Sincronizado (PWA)

App de levas paralelas de cronômetros sincronizados — dentro de cada leva,
todos os itens terminam juntos; o app avisa com som a hora de iniciar cada
item de menor tempo e o bipe de "split" na metade.

PWA: instalável na tela inicial e funciona offline (service worker via
`vite-plugin-pwa`). Persistência em `localStorage`.

## Rodar localmente

```bash
npm install
npm run dev
```

> O service worker do PWA só é gerado no build. Para testar o modo
> offline/instalável localmente:

```bash
npm run build
npm run preview
```

## Subir para o GitHub

```bash
git init
git add .
git commit -m "Cronômetro Sincronizado PWA"
gh repo create cronometro-sincronizado --public --source=. --push
# (ou crie o repo no site e use: git remote add origin <url> && git push -u origin main)
```

## Deploy

**Vercel / Netlify / Cloudflare Pages:** importe o repositório. Preset
"Vite" é detectado automaticamente (build `npm run build`, output `dist`).

**Hostinger:** rode `npm run build` e suba o conteúdo de `dist/` para o
document root de um subdomínio. PWA exige HTTPS (a Hostinger já fornece).

## Avisos importantes

- **Áudio:** navegadores exigem um toque do usuário antes de tocar som.
  O botão "Iniciar leva" já desbloqueia; se necessário use "Testar som".
- **Tela apagada:** timers em JS não disparam com o app em segundo plano
  no celular. Para uso na cozinha, mantenha a tela ligada (no app instalado
  em standalone isso funciona bem; se quiser, dá para adicionar Wake Lock API).
- Os ícones em `public/` podem ser trocados por arte própria (192px e 512px).
