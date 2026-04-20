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
    // Cargar doctores y asistentes en caso de que se cambie a esos tabs
    loadDoctorsList();
    loadAssistantsList();
  }
}

// Cambiar entre tabs
function switchUsersTab(tab) {
  const listTab = document.getElementById('usersListTab');
  const createTab = document.getElementById('usersCreateTab');
  const doctorsTab = document.getElementById('doctorsTab');
  const assistantsTab = document.getElementById('assistantsTab');
  const listSection = document.getElementById('usersListSection');
  const createSection = document.getElementById('usersCreateSection');
  const doctorsSection = document.getElementById('doctorsSection');
  const assistantsSection = document.getElementById('assistantsSection');
  
  // Remover active de todos los tabs
  [listTab, createTab, doctorsTab, assistantsTab].forEach(t => {
    if (t) t.classList.remove('active');
  });
  
  // Ocultar todas las secciones
  [listSection, createSection, doctorsSection, assistantsSection].forEach(s => {
    if (s) s.style.display = 'none';
  });
  
  if (tab === 'list') {
    if (listTab) listTab.classList.add('active');
    if (listSection) listSection.style.display = 'block';
    loadUsersList();
  } else if (tab === 'create') {
    if (createTab) createTab.classList.add('active');
    if (createSection) createSection.style.display = 'block';
  } else if (tab === 'doctors') {
    if (doctorsTab) doctorsTab.classList.add('active');
    if (doctorsSection) doctorsSection.style.display = 'block';
    loadDoctorsList();
  } else if (tab === 'assistants') {
    if (assistantsTab) assistantsTab.classList.add('active');
    if (assistantsSection) assistantsSection.style.display = 'block';
    loadAssistantsList();
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

  // Crear doctor
  const createDoctorForm = document.getElementById('createDoctorForm');
  if (createDoctorForm) {
    createDoctorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newDoctorName').value.trim();
      if (!name) return alert('Ingrese el nombre del doctor');
      
      try {
        // Verificar si ya existe
        const doctorsRef = firebase.database().ref('doctors');
        const snapshot = await doctorsRef.once('value');
        const doctors = snapshot.val() || {};
        const doctorsArray = Object.values(doctors);
        
        if (doctorsArray.includes(name)) {
          alert('Este doctor ya está registrado');
          return;
        }
        
        // Crear nuevo doctor
        const newDoctorRef = doctorsRef.push();
        await newDoctorRef.set(name);
        
        alert(`Doctor "${name}" agregado correctamente`);
        createDoctorForm.reset();
        loadDoctorsList();
        // Recargar selects de doctores
        loadDoctorsIntoSelects();
      } catch (error) {
        console.error('Error creando doctor:', error);
        alert('Error al crear el doctor: ' + error.message);
      }
    });
  }

  // Crear asistente
  const createAssistantForm = document.getElementById('createAssistantForm');
  if (createAssistantForm) {
    createAssistantForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newAssistantName').value.trim();
      if (!name) return alert('Ingrese el nombre del asistente');
      
      try {
        // Verificar si ya existe
        const assistantsRef = firebase.database().ref('assistants');
        const snapshot = await assistantsRef.once('value');
        const assistants = snapshot.val() || {};
        const assistantsArray = Object.values(assistants);
        
        if (assistantsArray.includes(name)) {
          alert('Este asistente ya está registrado');
          return;
        }
        
        // Crear nuevo asistente
        const newAssistantRef = assistantsRef.push();
        await newAssistantRef.set(name);
        
        alert(`Asistente "${name}" agregado correctamente`);
        createAssistantForm.reset();
        loadAssistantsList();
        // Recargar selects de asistentes
        loadAssistantsIntoSelects();
      } catch (error) {
        console.error('Error creando asistente:', error);
        alert('Error al crear el asistente: ' + error.message);
      }
    });
  }

  // Cargar doctores y asistentes en selects al cargar la página
  if (firebase && firebase.database) {
    loadDoctorsIntoSelects();
    loadAssistantsIntoSelects();
  }
});

// ========== GESTIÓN DE DOCTORES ==========

// Cargar lista de doctores desde Firebase
async function loadDoctorsList() {
  const container = document.getElementById('doctorsListContainer');
  if (!container) return;
  
  try {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;"><i class="fas fa-spinner fa-spin"></i> Cargando doctores...</div>';
    
    const doctorsRef = firebase.database().ref('doctors');
    const snapshot = await doctorsRef.once('value');
    const doctors = snapshot.val();
    
    if (!doctors || Object.keys(doctors).length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;"><i class="fas fa-user-md"></i> No hay doctores registrados</div>';
      return;
    }
    
    // Convertir objeto a array y ordenar por nombre
    const doctorsArray = Object.keys(doctors).map(id => ({
      id,
      name: doctors[id]
    })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    renderDoctorsList(doctorsArray);
  } catch (error) {
    console.error('Error cargando doctores:', error);
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #d32f2f;"><i class="fas fa-exclamation-triangle"></i> Error al cargar doctores</div>';
  }
}

// Renderizar lista de doctores
function renderDoctorsList(doctors) {
  const container = document.getElementById('doctorsListContainer');
  if (!container) return;
  
  if (doctors.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No se encontraron doctores</div>';
    return;
  }
  
  let html = '<table style="width: 100%; border-collapse: collapse; font-size: 14px;">';
  html += '<thead><tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">';
  html += '<th style="padding: 12px; text-align: left;">Nombre</th>';
  html += '<th style="padding: 12px; text-align: center;">Acciones</th>';
  html += '</tr></thead><tbody>';
  
  doctors.forEach(doctor => {
    html += `<tr style="border-bottom: 1px solid #eee;" data-doctor-id="${doctor.id}">`;
    html += `<td style="padding: 12px;"><strong>${doctor.name || 'Sin nombre'}</strong></td>`;
    html += `<td style="padding: 12px; text-align: center;">
      <button onclick="deleteDoctor('${doctor.id}', '${doctor.name.replace(/'/g, "\\'")}')" 
              style="background: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 5px;">
        <i class="fas fa-trash"></i> Eliminar
      </button>
    </td>`;
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

// Filtrar lista de doctores
function filterDoctorsList() {
  const searchTerm = document.getElementById('doctorsSearchInput').value.toLowerCase();
  const rows = document.querySelectorAll('#doctorsListContainer tbody tr');
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? '' : 'none';
  });
}

// Eliminar doctor
function deleteDoctor(id, name) {
  if (!confirm(`¿Está seguro de eliminar al doctor "${name}"?`)) {
    return;
  }
  
  firebase.database().ref(`doctors/${id}`).remove()
    .then(() => {
      alert(`Doctor "${name}" eliminado correctamente`);
      loadDoctorsList();
      // Recargar selects de doctores en toda la aplicación
      loadDoctorsIntoSelects();
    })
    .catch(error => {
      console.error('Error eliminando doctor:', error);
      alert('Error al eliminar el doctor: ' + error.message);
    });
}

// ========== GESTIÓN DE ASISTENTES ==========

// Cargar lista de asistentes desde Firebase
async function loadAssistantsList() {
  const container = document.getElementById('assistantsListContainer');
  if (!container) return;
  
  try {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;"><i class="fas fa-spinner fa-spin"></i> Cargando asistentes...</div>';
    
    const assistantsRef = firebase.database().ref('assistants');
    const snapshot = await assistantsRef.once('value');
    const assistants = snapshot.val();
    
    if (!assistants || Object.keys(assistants).length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;"><i class="fas fa-user-nurse"></i> No hay asistentes registrados</div>';
      return;
    }
    
    // Convertir objeto a array y ordenar por nombre
    const assistantsArray = Object.keys(assistants).map(id => ({
      id,
      name: assistants[id]
    })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    renderAssistantsList(assistantsArray);
  } catch (error) {
    console.error('Error cargando asistentes:', error);
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #d32f2f;"><i class="fas fa-exclamation-triangle"></i> Error al cargar asistentes</div>';
  }
}

// Renderizar lista de asistentes
function renderAssistantsList(assistants) {
  const container = document.getElementById('assistantsListContainer');
  if (!container) return;
  
  if (assistants.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No se encontraron asistentes</div>';
    return;
  }
  
  let html = '<table style="width: 100%; border-collapse: collapse; font-size: 14px;">';
  html += '<thead><tr style="background: #f5f5f5; border-bottom: 2px solid #ddd;">';
  html += '<th style="padding: 12px; text-align: left;">Nombre</th>';
  html += '<th style="padding: 12px; text-align: center;">Acciones</th>';
  html += '</tr></thead><tbody>';
  
  assistants.forEach(assistant => {
    html += `<tr style="border-bottom: 1px solid #eee;" data-assistant-id="${assistant.id}">`;
    html += `<td style="padding: 12px;"><strong>${assistant.name || 'Sin nombre'}</strong></td>`;
    html += `<td style="padding: 12px; text-align: center;">
      <button onclick="deleteAssistant('${assistant.id}', '${assistant.name.replace(/'/g, "\\'")}')" 
              style="background: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 5px;">
        <i class="fas fa-trash"></i> Eliminar
      </button>
    </td>`;
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

// Filtrar lista de asistentes
function filterAssistantsList() {
  const searchTerm = document.getElementById('assistantsSearchInput').value.toLowerCase();
  const rows = document.querySelectorAll('#assistantsListContainer tbody tr');
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchTerm) ? '' : 'none';
  });
}

// Eliminar asistente
function deleteAssistant(id, name) {
  if (!confirm(`¿Está seguro de eliminar al asistente "${name}"?`)) {
    return;
  }
  
  firebase.database().ref(`assistants/${id}`).remove()
    .then(() => {
      alert(`Asistente "${name}" eliminado correctamente`);
      loadAssistantsList();
      // Recargar selects de asistentes en toda la aplicación
      loadAssistantsIntoSelects();
    })
    .catch(error => {
      console.error('Error eliminando asistente:', error);
      alert('Error al eliminar el asistente: ' + error.message);
    });
}

// ========== FUNCIONES PARA CARGAR EN SELECTS ==========

// Cargar doctores en todos los selects
async function loadDoctorsIntoSelects() {
  try {
    const doctorsRef = firebase.database().ref('doctors');
    const snapshot = await doctorsRef.once('value');
    const doctors = snapshot.val();
    
    if (!doctors) return;
    
    const doctorsArray = Object.values(doctors).sort();
    
    // IDs de todos los selects de doctores
    const selectIds = [
      'doctorAtiende',
      'editDoctorAtiende',
      'quirofanoDoctorAtiende',
      'editQuirofanoDoctorAtiende',
      'labMedicoFilter',
      'editLabMedico'
    ];
    
    selectIds.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (select) {
        const currentValue = select.value;
        // Mantener la primera opción (Seleccione...)
        const firstOption = select.options[0] ? select.options[0].outerHTML : '<option value="">Seleccione un doctor</option>';
        // Para labMedicoFilter, mantener también las opciones especiales
        if (selectId === 'labMedicoFilter') {
          select.innerHTML = '<option value="">Todos los médicos</option><option value="Medico Externo">Médico Externo</option><option value="N.A">N.A</option>';
        } else if (selectId === 'editLabMedico') {
          // Para editLabMedico, mantener opciones especiales
          select.innerHTML = '<option value="">Seleccione un médico</option><option value="Medico Externo">Médico Externo</option><option value="Medico Internista">Médico Internista</option><option value="N.A">N.A</option>';
        } else {
          select.innerHTML = firstOption;
        }
        
        doctorsArray.forEach(doctorName => {
          const option = document.createElement('option');
          option.value = doctorName;
          option.textContent = doctorName;
          if (doctorName === currentValue) {
            option.selected = true;
          }
          select.appendChild(option);
        });
      }
    });
    
    // Cargar doctores en datalists (para páginas HTML de laboratorio)
    loadDoctorsIntoDatalists(doctorsArray);
  } catch (error) {
    console.error('Error cargando doctores en selects:', error);
  }
}

// Cargar doctores en datalists (para páginas HTML de laboratorio)
function loadDoctorsIntoDatalists(doctorsArray) {
  // IDs de todos los datalists de doctores
  const datalistIds = ['medicos'];
  
  datalistIds.forEach(datalistId => {
    const datalist = document.getElementById(datalistId);
    if (datalist) {
      // Limpiar opciones existentes (excepto N.A si existe)
      const existingOptions = Array.from(datalist.querySelectorAll('option'));
      const hasNA = existingOptions.some(opt => opt.value === 'N.A');
      
      datalist.innerHTML = '';
      
      // Agregar N.A primero si existía
      if (hasNA) {
        const naOption = document.createElement('option');
        naOption.value = 'N.A';
        datalist.appendChild(naOption);
      }
      
      // Agregar todos los doctores
      doctorsArray.forEach(doctorName => {
        const option = document.createElement('option');
        option.value = doctorName;
        datalist.appendChild(option);
      });
    }
  });
}

// Cargar asistentes en todos los selects
async function loadAssistantsIntoSelects() {
  try {
    const assistantsRef = firebase.database().ref('assistants');
    const snapshot = await assistantsRef.once('value');
    const assistants = snapshot.val();
    
    if (!assistants) return;
    
    const assistantsArray = Object.values(assistants).sort();
    
    // IDs de todos los selects de asistentes
    const selectIds = [
      'asistenteAtiende',
      'editAsistenteAtiende',
      'quirofanoAsistenteAtiende',
      'editQuirofanoAsistenteAtiende'
    ];
    
    selectIds.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (select) {
        const currentValue = select.value;
        // Mantener la primera opción (Seleccione...)
        const firstOption = select.options[0] ? select.options[0].outerHTML : '<option value="">Seleccione un asistente</option>';
        select.innerHTML = firstOption;
        
        assistantsArray.forEach(assistantName => {
          const option = document.createElement('option');
          option.value = assistantName;
          option.textContent = assistantName;
          if (assistantName === currentValue) {
            option.selected = true;
          }
          select.appendChild(option);
        });
      }
    });
  } catch (error) {
    console.error('Error cargando asistentes en selects:', error);
  }
}

// Exportar funciones al scope global
window.showAdminUsersBtnIfAdmin = showAdminUsersBtnIfAdmin;
window.openAdminUsersModal = openAdminUsersModal;
window.switchUsersTab = switchUsersTab;
window.loadUsersList = loadUsersList;
window.filterUsersList = filterUsersList;
window.editUserEmpresa = editUserEmpresa;
window.loadDoctorsList = loadDoctorsList;
window.filterDoctorsList = filterDoctorsList;
window.deleteDoctor = deleteDoctor;
window.loadAssistantsList = loadAssistantsList;
window.filterAssistantsList = filterAssistantsList;
window.deleteAssistant = deleteAssistant;
window.loadDoctorsIntoSelects = loadDoctorsIntoSelects;
window.loadAssistantsIntoSelects = loadAssistantsIntoSelects;
window.loadDoctorsIntoDatalists = loadDoctorsIntoDatalists;