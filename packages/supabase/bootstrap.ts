import { bootstrapSuperAdmins, getSuperAdminEmails } from './server.ts'

async function main() {
  console.log('--- MaestroSync Super Admin Bootstrap ---')
  const emails = getSuperAdminEmails()

  if (emails.length === 0) {
    console.warn(
      '⚠️ No se encontraron correos en SUPER_ADMIN_BOOTSTRAP_EMAILS. Define esta variable en .env o .env.local.'
    )
    process.exit(0)
  }

  console.log(`📋 Correos objetivo (${emails.length}):`, emails.join(', '))
  console.log('🔄 Sincronizando con Supabase Auth y public.profiles...')

  try {
    const result = await bootstrapSuperAdmins()

    if (result.bootstrapped.length > 0) {
      console.log('✅ Super Admins asegurados en la base de datos:')
      for (const email of result.bootstrapped) {
        console.log(`   - ${email} (is_platform_admin = true)`)
      }
    }

    if (result.errors.length > 0) {
      console.error('❌ Errores al sincronizar algunos correos:')
      for (const err of result.errors) {
        console.error(`   - ${err.email}: ${err.error}`)
      }
      process.exit(1)
    }

    console.log('✨ Bootstrap completado con éxito.')
  } catch (error: any) {
    console.error('❌ Error fatal en bootstrap:', error?.message || error)
    process.exit(1)
  }
}

main()
