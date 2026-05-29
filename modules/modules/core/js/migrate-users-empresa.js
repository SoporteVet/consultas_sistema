// Script de migración para agregar campo empresa a usuarios existentes
// Este script se debe ejecutar UNA SOLA VEZ desde la consola del navegador
// en la página principal del sistema (index.html) después de hacer login como admin

async function migrateUsersToEmpresa() {
  console.log('🔄 Iniciando migración de usuarios...');
  
  try {
    const usersRef = firebase.database().ref('users');
    const snapshot = await usersRef.once('value');
    const users = snapshot.val();
    
    if (!users) {
      console.log('❌ No se encontraron usuarios para migrar');
      return;
    }
    
    let migratedCount = 0;
    let alreadyMigratedCount = 0;
    const updates = {};
    
    // Recorrer todos los usuarios
    for (const userId in users) {
      const user = users[userId];
      
      // Si el usuario no tiene empresa, asignar veterinaria_smp
      if (!user.empresa) {
        updates[`users/${userId}/empresa`] = 'veterinaria_smp';
        migratedCount++;
        console.log(`✅ Migrando usuario: ${user.email || user.name} -> veterinaria_smp`);
      } else {
        alreadyMigratedCount++;
        console.log(`⏭️  Usuario ya tiene empresa: ${user.email || user.name} -> ${user.empresa}`);
      }
    }
    
    // Aplicar todas las actualizaciones
    if (Object.keys(updates).length > 0) {
      await firebase.database().ref().update(updates);
      console.log(`\n✅ Migración completada!`);
      console.log(`   - Usuarios migrados: ${migratedCount}`);
      console.log(`   - Usuarios ya con empresa: ${alreadyMigratedCount}`);
      console.log(`   - Total de usuarios: ${Object.keys(users).length}`);
    } else {
      console.log('\n✅ Todos los usuarios ya tienen empresa asignada. No se requiere migración.');
    }
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  }
}

// Ejecutar automáticamente si se carga este script
console.log('📋 Script de migración de usuarios cargado.');
console.log('⚠️  Para ejecutar la migración, escribe en la consola: migrateUsersToEmpresa()');

// Exportar función globalmente
window.migrateUsersToEmpresa = migrateUsersToEmpresa;



