import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Sem isso o navegador do celular baixa o .apk sem Content-Type, e o Android
// trata o arquivo como um zip qualquer (oferece "extrair") em vez de reconhecer
// como app instalável
function apkContentType(): Plugin {
  return {
    name: 'apk-content-type',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0].endsWith('.apk')) {
          res.setHeader('Content-Type', 'application/vnd.android.package-archive')
        }
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0].endsWith('.apk')) {
          res.setHeader('Content-Type', 'application/vnd.android.package-archive')
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apkContentType()],
})
