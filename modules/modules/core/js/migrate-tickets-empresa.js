// Script de migración para agregar campo empresa a tickets existentes
// Este script se debe ejecutar UNA SOLA VEZ desde la consola del navegador
// en la página principal del sistema (index.html) después de hacer login como admin

async function migrateTicketsToEmpresa() {
  console.log('🔄 Iniciando migración de tickets...');
  
  try {
    const ticketsRef = firebase.database().ref('tickets');
    const snapshot = await ticketsRef.once('value');
    const tickets = snapshot.val();
    
    if (!tickets) {
      console.log('❌ No se encontraron tickets para migrar');
      return;
    }
    
    let migratedCount = 0;
    let alreadyMigratedCount = 0;
    const updates = {};
    
    // Recorrer todos los tickets
    for (const ticketKey in tickets) {
      const ticket = tickets[ticketKey];
      
      // Si el ticket no tiene empresa, asignar veterinaria_smp
      if (!ticket.empresa) {
        updates[`tickets/${ticketKey}/empresa`] = 'veterinaria_smp';
        migratedCount++;
        console.log(`✅ Migrando ticket #${ticket.id} (${ticket.nombre}) -> veterinaria_smp`);
      } else {
        alreadyMigratedCount++;
        console.log(`⏭️  Ticket #${ticket.id} ya tiene empresa: ${ticket.empresa}`);
      }
    }
    
    // Aplicar todas las actualizaciones
    if (Object.keys(updates).length > 0) {
      await firebase.database().ref().update(updates);
      console.log(`\n✅ Migración completada!`);
      console.log(`   - Tickets migrados: ${migratedCount}`);
      console.log(`   - Tickets ya con empresa: ${alreadyMigratedCount}`);
      console.log(`   - Total de tickets: ${Object.keys(tickets).length}`);
      console.log('\n🔄 Recargando página para aplicar cambios...');
      
      // Recargar la página después de 2 segundos para aplicar cambios
      setTimeout(() => {
        location.reload();
      }, 2000);
    } else {
      console.log('\n✅ Todos los tickets ya tienen empresa asignada. No se requiere migración.');
    }
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  }
}

// Ejecutar automáticamente si se carga este script
console.log('📋 Script de migración de tickets cargado.');
console.log('⚠️  Para ejecutar la migración, escribe en la consola: migrateTicketsToEmpresa()');

// Exportar función globalmente
window.migrateTicketsToEmpresa = migrateTicketsToEmpresa;



