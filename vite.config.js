import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  /* strictPort matters more than it looks: Supabase's redirect allow-list is matched on the
     exact origin, so if Vite quietly moved to 5174 because 5173 was busy, every confirmation
     and password-reset link would bounce. Better to fail loudly and free the port. */
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
});
