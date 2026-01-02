// Mostrar el botón solo para admin
function showAdminUsersBtnIfAdmin() {
  if (sessionStorage.getItem('userRole') === 'admin') {
    document.getElementById('adminUsersBtn').style.display = 'block';
    const adminUsersSubmenuBtn = document.getElementById('adminUsersSubmenuBtn');
    if (adminUsersSubmenuBtn) adminUsersSubmenuBtn.style.display = 'block';
  }
}

// Abrir modal de administración de usuarios
function openAdminUsersModal() {
  const modal = document.getElementById('adminUsersModal');
  if (modal) {
    modal.style.display = 'flex';
    // Cargar lista de usuarios al abrir
    loadUsersList();
  }
}

// Cambiar entre tabs
function switchUsersTab(tab) {
  const listTab = document.getElementById('usersListTab');
  const createTab = document.getElementById('usersCreateTab');
  const listSection = document.getElementById('usersListSection');
  const createSection = document.getElementById('usersCreateSection');
  
  if (tab === 'list') {
    listTab.classList.add('active');
    createTab.classList.remove('active');
    listSection.style.display = 'block';
    createSection.style.display = 'none';
    loadUsersList();
  } else {
    createTab.classList.add('active');
    listTab.classList.remove('active');
    createSection.style.display = 'block';
    listSection.style.display = 'none';
  }
}

// Cargar lista de usuarios desde Firebase
async function loadUsersList() {
  const container = document.getElementById('usersListContainer');
  if (!container) return;
  
  try {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;"><i class="fas fa-spinner fa-spin"></i> Cargando usuarios...</div>';
    
    const usersRef = firebase.database().ref('users');
    const snapshot = await usersRef.once('value');
    const users = snapshot.val();
    
    if (!users || Object.keys(users).length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;"><i class="fas fa-users"></i> No hay usuarios registrados</div>';
      return;
    }
    
    // Convertir objeto a array y ordenar por nombre
    const usersArray = Object.keys(users).map(uid => ({
      uid,
      ...users[uid]
    })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    renderUsersList(usersArray);
  } catch (error) {
    console.error('Error cargando usuarios:', error);
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #d32f2f;"><i class="fas fa-exclamation-triangle"></i> Error al cargar usuarios</div>';
  }
}

// Renderizar lista de usuarios
function renderUsersList(users) {
  const container = document.getElementById('usersListContainer');
  if (!container) return;
  
  const empresaNames = {
    'veterinaria_smp': 'Veterinaria San Martín de Porres',
    'instituto_smp': 'Instituto Veterinario San Martín de Porres'
  };
  
  const roleNames = {
    'admin': 'Administrador',
    'recepcion': 'Recepción',
    'consulta_externa': 'Consulta Externa',
    'laboratorio': 'Laboratorio',
    'quirofano': 'Quirófano',
    'internos': 'Internos',
    'visitas': 'Visitas'
  };
  
  if (users.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No se encontraron usuarios</div>';
    return;
  }
  
  let html = '<table style="width: 100%; border-collapse: collapse; font-size: 14px;">';
  html += '<thead><tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">';
  html += '<th style="padding: 12px; text-align: left;">Nombre</th>';
  html += '<th style="padding: 12px; text-align: left;">Email</th>';
  html += '<th style="padding: 12px; text-align: left;">Rol</th>';
  html += '<th style="padding: 12px; text-align: left;">Empresa</th>';
  html += '<th style="padding: 12px; text-align: center;">Acciones</th>';
  html += '</tr></thead><tbody>';
  
  users.forEach(user => {
    const empresaName = empresaNames[user.empresa] || user.empresa || 'No asignada';
    const roleName = roleNames[user.role] || user.role || 'Sin rol';
    const empresaColor = user.empresa === 'veterinaria_smp' ? '#4CAF50' : user.empresa === 'instituto_smp' ? '#9C27B0' : '#999';
    
    html += `<tr style="border-bottom: 1px solid #eee;" data-user-id="${user.uid}">`;
    html += `<td style="padding: 12px;"><strong>${user.name || 'Sin nombre'}</strong></td>`;
    html += `<td style="padding: 12px;">${user.email || 'Sin email'}</td>`;
    html += `<td style="padding: 12px;"><span style="background: #2196F3; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${roleName}</span></td>`;
    html += `<td style="padding: 12px;">
      <span style="background: ${empresaColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; display: inline-block;">
        <i class="fas fa-building"></i> ${empresaName}
      </span>
    </td>`;
    html += `<td style="padding: 12px; text-align: center;">
      <button onclick="editUserEmpresa('${user.uid}', '${user.name || ''}', '${user.empresa || ''}')" 
              style="background: #FF9800; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
        <i class="fas fa-edit"></i> Editar Empresa
      </button>
    </td>`;
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

// Filtrar lista de usuarios
function filterUsersList() {
  const searchTerm = document.getElementById('usersSearchInput').value.toLowerCase();
  const rows = document.querySelectorAll('#usersListContainer tbody tr');
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? '' : 'none';
  });
}

// Editar empresa de usuario
function editUserEmpresa(uid, userName, currentEmpresa) {
  const newEmpresa = prompt(
    `Cambiar empresa para: ${userName}\n\nEmpresa actual: ${currentEmpresa || 'No asignada'}\n\nIngrese nueva empresa:\n1. veterinaria_smp\n2. instituto_smp`,
    currentEmpresa || 'veterinaria_smp'
  );
  
  if (!newEmpresa || (newEmpresa !== 'veterinaria_smp' && newEmpresa !== 'instituto_smp')) {
    if (newEmpresa !== null) {
      alert('Empresa inválida. Use: veterinaria_smp o instituto_smp');
    }
    return;
  }
  
  if (newEmpresa === currentEmpresa) {
    return; // No hay cambios
  }
  
  // Actualizar en Firebase
  firebase.database().ref(`users/${uid}/empresa`).set(newEmpresa)
    .then(() => {
      alert(`Empresa actualizada correctamente para ${userName}`);
      loadUsersList(); // Recargar lista
    })
    .catch(error => {
      console.error('Error actualizando empresa:', error);
      alert('Error al actualizar la empresa: ' + error.message);
    });
}

document.addEventListener('DOMContentLoaded', () => {
  showAdminUsersBtnIfAdmin();

  const adminBtn = document.getElementById('adminUsersBtn');
  const adminUsersSubmenuBtn = document.getElementById('adminUsersSubmenuBtn');
  const modal = document.getElementById('adminUsersModal');
  const closeBtn = document.getElementById('closeAdminUsersModal');
  const createUserForm = document.getElementById('createUserForm');

  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      openAdminUsersModal();
    });
  }
  if (adminUsersSubmenuBtn) {
    adminUsersSubmenuBtn.addEventListener('click', () => {
      openAdminUsersModal();
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  // Crear usuario
  if (createUserForm) {
    createUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('newUserEmail').value.trim();
      const name = document.getElementById('newUserName').value.trim();
      const role = document.getElementById('newUserRole').value;
      const empresa = document.getElementById('newUserEmpresa').value;
      if (!email || !name || !role || !empresa) return alert('Completa todos los campos');
      try {
        // Crear usuario con contraseña temporal
        const tempPassword = Math.random().toString(36).slice(-8) + 'A1';
        const userCred = await firebase.auth().createUserWithEmailAndPassword(email, tempPassword);
        // Guardar datos en la base de datos
        await firebase.database().ref('users/' + userCred.user.uid).set({
          email, name, role, empresa
        });
        alert('Usuario creado. La contraseña temporal es: ' + tempPassword);
        createUserForm.reset();
        // Recargar lista de usuarios
        loadUsersList();
        // Cambiar a la pestaña de lista
        switchUsersTab('list');
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
          alert('El correo ya está registrado.');
        } else {
          alert('Error: ' + err.message);
        }
      }
    });
  }
});

// Exportar funciones al scope global
window.showAdminUsersBtnIfAdmin = showAdminUsersBtnIfAdmin;
window.openAdminUsersModal = openAdminUsersModal;
window.switchUsersTab = switchUsersTab;
window.loadUsersList = loadUsersList;
window.filterUsersList = filterUsersList;
window.editUserEmpresa = editUserEmpresa;