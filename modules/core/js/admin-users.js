function isCurrentUserAdmin() {
  if (typeof window.isAdminRole === 'function') {
    return window.isAdminRole(sessionStorage.getItem('userRole'));
  }
  const r = String(sessionStorage.getItem('userRole') || '').toLowerCase().trim();
  return r === 'admin' || r === 'administrador';
}

// ---------- Helpers de perfil de médico ----------
// El nodo `doctors/{id}` puede ser un string (legacy) o un objeto { name, cmv, firma, pin }.
// Estos helpers normalizan la lectura para que el resto del código no se preocupe del formato.
function normalizeDoctorProfile(value) {
  if (value == null) return null;
  if (typeof value === 'string') return { name: value, cmv: '', firma: '', pin: '' };
  if (typeof value === 'object') {
    return {
      name: value.name || '',
      cmv: value.cmv || '',
      firma: value.firma || '',
      pin: value.pin || ''
    };
  }
  return null;
}

function getDoctorNameFromRaw(value) {
  const profile = normalizeDoctorProfile(value);
  return profile ? profile.name : '';
}

// Buscar perfil completo de un doctor por su nombre (usado al generar recetas).
async function findDoctorProfileByName(name) {
  if (!name) return null;
  try {
    const snapshot = await firebase.database().ref('doctors').once('value');
    const doctors = snapshot.val() || {};
    for (const id of Object.keys(doctors)) {
      const profile = normalizeDoctorProfile(doctors[id]);
      if (profile && profile.name === name) {
        return { id, ...profile };
      }
    }
  } catch (err) {
    console.error('Error buscando perfil de doctor:', err);
  }
  return null;
}

// App secundaria: crear usuarios sin cerrar la sesión del administrador
function getSecondaryAuth() {
  const primaryApp = firebase.app();
  const secondaryName = 'UserAdminSecondary';
  let secondaryApp = firebase.apps.find((a) => a.name === secondaryName);
  if (!secondaryApp) {
    secondaryApp = firebase.initializeApp(primaryApp.options, secondaryName);
  }
  return secondaryApp.auth();
}

// Mostrar el botón solo para admin
function showAdminUsersBtnIfAdmin() {
  if (!isCurrentUserAdmin()) return;

  const adminBtn = document.getElementById('adminUsersBtn');
  if (adminBtn) adminBtn.style.display = 'flex';

  const adminUsersSubmenuBtn = document.getElementById('adminUsersSubmenuBtn');
  if (adminUsersSubmenuBtn) adminUsersSubmenuBtn.style.display = 'flex';
}

// Abrir modal de administración de usuarios
function openAdminUsersModal() {
  const modal = document.getElementById('adminUsersModal');
  if (!modal) {
    alert('No se encontró el panel de administración. Recargue la página (F5) e intente de nuevo.');
    console.error('adminUsersModal no está en el DOM (pudo haberse eliminado por error).');
    return;
  }
  modal.style.display = 'flex';
  // Cargar lista de usuarios al abrir
  loadUsersList();
  // Cargar doctores y asistentes en caso de que se cambie a esos tabs
  loadDoctorsList();
  loadAssistantsList();
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
    const denied = error && (error.code === 'PERMISSION_DENIED' || String(error.message || '').includes('permission'));
    const hint = denied
      ? '<br><small>Revise las reglas de Firebase: el administrador debe poder leer la ruta <strong>users</strong>.</small>'
      : '';
    container.innerHTML = `<div style="text-align: center; padding: 20px; color: #d32f2f;"><i class="fas fa-exclamation-triangle"></i> Error al cargar usuarios.${hint}</div>`;
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
    'lab_reportes': 'Reportes Lab',
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
      if (!isCurrentUserAdmin()) return alert('Solo un administrador puede crear usuarios.');
      try {
        const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
        const secondaryAuth = getSecondaryAuth();
        const userCred = await secondaryAuth.createUserWithEmailAndPassword(email, tempPassword);
        await secondaryAuth.signOut();
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
        // Verificar si ya existe (soporta legacy y nuevo formato)
        const doctorsRef = firebase.database().ref('doctors');
        const snapshot = await doctorsRef.once('value');
        const doctors = snapshot.val() || {};
        const existingNames = Object.values(doctors).map(getDoctorNameFromRaw);
        
        if (existingNames.includes(name)) {
          alert('Este doctor ya está registrado');
          return;
        }
        
        // Crear nuevo doctor con la estructura extendida
        const newDoctorRef = doctorsRef.push();
        await newDoctorRef.set({ name, cmv: '', firma: '', pin: '' });
        
        alert(`Doctor "${name}" agregado correctamente. Configure CMV, firma y PIN desde el botón "Firma / CMV".`);
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
    
    // Normalizar (legacy string / objeto) y ordenar por nombre
    const doctorsArray = Object.keys(doctors).map(id => {
      const profile = normalizeDoctorProfile(doctors[id]) || { name: '', cmv: '', firma: '', pin: '' };
      return { id, ...profile };
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
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
  html += '<th style="padding: 12px; text-align: left;">CMV</th>';
  html += '<th style="padding: 12px; text-align: center;">Firma</th>';
  html += '<th style="padding: 12px; text-align: center;">PIN</th>';
  html += '<th style="padding: 12px; text-align: center;">Acciones</th>';
  html += '</tr></thead><tbody>';
  
  doctors.forEach(doctor => {
    const safeName = (doctor.name || '').replace(/'/g, "\\'");
    const hasFirma = !!(doctor.firma && String(doctor.firma).startsWith('data:image'));
    const firmaBadge = hasFirma
      ? '<span style="background:#4CAF50;color:white;padding:4px 8px;border-radius:4px;font-size:12px;"><i class="fas fa-check"></i> Registrada</span>'
      : '<span style="background:#bbb;color:white;padding:4px 8px;border-radius:4px;font-size:12px;"><i class="fas fa-times"></i> Sin firma</span>';
    const cmvText = doctor.cmv ? `<strong>${doctor.cmv}</strong>` : '<span style="color:#999;">—</span>';

    const hasPin = !!(doctor.pin && String(doctor.pin).trim());
    const pinBadge = hasPin
      ? '<span style="background:#4CAF50;color:white;padding:4px 8px;border-radius:4px;font-size:12px;"><i class="fas fa-lock"></i> Activo</span>'
      : '<span style="background:#ff9800;color:white;padding:4px 8px;border-radius:4px;font-size:12px;"><i class="fas fa-unlock"></i> Sin PIN</span>';

    html += `<tr style="border-bottom: 1px solid #eee;" data-doctor-id="${doctor.id}">`;
    html += `<td style="padding: 12px;"><strong>${doctor.name || 'Sin nombre'}</strong></td>`;
    html += `<td style="padding: 12px;">${cmvText}</td>`;
    html += `<td style="padding: 12px; text-align: center;">${firmaBadge}</td>`;
    html += `<td style="padding: 12px; text-align: center;">${pinBadge}</td>`;
    html += `<td style="padding: 12px; text-align: center; white-space: nowrap;">
      <button onclick="openDoctorSignatureModal('${doctor.id}', '${safeName}')" 
              style="background: #3f51b5; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
        <i class="fas fa-signature"></i> Firma / CMV
      </button>
      <button onclick="deleteDoctor('${doctor.id}', '${safeName}')" 
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
    
    // Soporta legacy (string) y nuevo formato ({ name, cmv, firma })
    const doctorsArray = Object.values(doctors)
      .map(getDoctorNameFromRaw)
      .filter(Boolean)
      .sort();
    
    // IDs de todos los selects de doctores
    const selectIds = [
      'doctorAtiende',
      'editDoctorAtiende',
      'quirofanoDoctorAtiende',
      'editQuirofanoDoctorAtiende',
      'labMedicoSolicita',
      'labMedicoFilter',
      'editLabMedico',
      'internamientoDoctorAdmision',
      'internamientoDoctorUltrasonido',
      'pendientesReportarDoctorSelect'
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
        } else if (selectId === 'pendientesReportarDoctorSelect') {
          select.innerHTML = '<option value="">-- Seleccione un médico --</option><option value="Medico Externo">Médico Externo</option><option value="N.A">N.A</option>';
        } else if (selectId === 'labMedicoSolicita') {
          select.innerHTML = '<option value="">Seleccione un médico</option><option value="Medico Externo">Médico Externo</option><option value="N.A">N.A</option>';
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

    // Desplegable Rayos X: doctores + técnicos
    loadDoctorsAndAssistantsIntoRayosXSelect();
  } catch (error) {
    console.error('Error cargando doctores en selects:', error);
  }
}

// Cargar doctores y técnicos en el desplegable "¿Qué doctor realizó los Rayos X?"
async function loadDoctorsAndAssistantsIntoRayosXSelect() {
  try {
    const doctorsRef = firebase.database().ref('doctors');
    const assistantsRef = firebase.database().ref('assistants');
    const [doctorsSnap, assistantsSnap] = await Promise.all([
      doctorsRef.once('value'),
      assistantsRef.once('value')
    ]);
    const doctors = doctorsSnap.val() || {};
    const assistants = assistantsSnap.val() || {};
    const doctorsArray = Object.values(doctors).map(getDoctorNameFromRaw).filter(Boolean);
    const assistantsArray = Object.values(assistants);
    const combined = [...new Set([...doctorsArray, ...assistantsArray])].sort();
    const select = document.getElementById('internamientoDoctorRayosX');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Seleccione un doctor o técnico</option>';
    combined.forEach(function(name) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === currentValue) option.selected = true;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error cargando doctores y técnicos en select Rayos X:', error);
  }
}

// Cargar doctores en datalists (para páginas HTML de laboratorio)
function loadDoctorsIntoDatalists(doctorsArray) {
  // IDs de todos los datalists de doctores
  const datalistIds = ['medicos', 'medicos2', 'medicos3'];
  
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
    const assistantsArray = assistants ? Object.values(assistants).sort() : [];
    
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

    // Actualizar desplegable Rayos X (doctores + técnicos)
    loadDoctorsAndAssistantsIntoRayosXSelect();
  } catch (error) {
    console.error('Error cargando asistentes en selects:', error);
  }
}

// ========== MODAL DE FIRMA / CMV DEL DOCTOR ==========

// Estado interno del canvas (un único modal a la vez).
const __doctorSignatureCanvasState = { drawing: false, lastX: 0, lastY: 0 };

function openDoctorSignatureModal(doctorId, doctorName) {
  if (!isCurrentUserAdmin()) {
    alert('Solo un administrador puede configurar la firma o el CMV.');
    return;
  }
  // Cerrar modal previo si quedó abierto
  const existing = document.getElementById('doctorSignatureModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'doctorSignatureModal';
  modal.className = 'edit-modal';
  modal.style.zIndex = '2100';
  modal.innerHTML = `
    <div class="modal-content animate-scale" style="max-width:560px;">
      <span class="close-modal" onclick="closeDoctorSignatureModal()">&times;</span>
      <h3><i class="fas fa-signature"></i> Firma, CMV y PIN — ${doctorName}</h3>
      <p style="color:#666;font-size:13px;margin-bottom:12px;">
        Esta firma y PIN se utilizarán en las recetas digitales generadas por este médico.
      </p>
      <div class="form-group">
        <label for="doctorCmvInput"><strong>CMV (Colegio de Médicos Veterinarios)</strong></label>
        <input type="text" id="doctorCmvInput" placeholder="Ej: 12345" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:5px;">
      </div>
      <div class="form-group">
        <label for="doctorPinInput"><strong>PIN de receta (4–6 dígitos)</strong></label>
        <input type="password" id="doctorPinInput" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password"
          placeholder="Ej: 1234" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:5px;letter-spacing:0.2em;">
        <small id="doctorPinHint" style="color:#888;display:block;margin-top:4px;">Obligatorio para autorizar recetas digitales.</small>
      </div>
      <div class="form-group">
        <label><strong>Firma</strong></label>
        <div id="doctorSignaturePreviewWrap" style="margin-bottom:8px;"></div>
        <div style="border:2px dashed #bbb;border-radius:8px;padding:6px;background:#fafafa;">
          <canvas id="doctorSignatureCanvas" width="500" height="180" style="width:100%;height:180px;background:white;border-radius:4px;cursor:crosshair;touch-action:none;"></canvas>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button type="button" onclick="clearDoctorSignatureCanvas()" style="background:#f0f0f0;border:1px solid #ccc;padding:6px 12px;border-radius:5px;cursor:pointer;">
            <i class="fas fa-eraser"></i> Limpiar
          </button>
          <span style="color:#999;font-size:12px;align-self:center;">Firme con el mouse o con el dedo en pantalla táctil.</span>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-cancel" onclick="closeDoctorSignatureModal()">Cancelar</button>
        <button type="button" class="btn-save" onclick="saveDoctorSignature('${doctorId}')">Guardar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  loadDoctorProfileIntoSignatureModal(doctorId);
  initDoctorSignatureCanvas();
}

function closeDoctorSignatureModal() {
  const modal = document.getElementById('doctorSignatureModal');
  if (modal) modal.remove();
}

async function loadDoctorProfileIntoSignatureModal(doctorId) {
  try {
    const snap = await firebase.database().ref(`doctors/${doctorId}`).once('value');
    const profile = normalizeDoctorProfile(snap.val()) || { name: '', cmv: '', firma: '', pin: '' };
    const cmvInput = document.getElementById('doctorCmvInput');
    if (cmvInput) cmvInput.value = profile.cmv || '';
    const pinHint = document.getElementById('doctorPinHint');
    if (pinHint) {
      pinHint.textContent = profile.pin
        ? 'PIN configurado. Deje el campo vacío para conservarlo o escriba uno nuevo para cambiarlo.'
        : 'Obligatorio para autorizar recetas digitales.';
    }
    const previewWrap = document.getElementById('doctorSignaturePreviewWrap');
    if (previewWrap) {
      if (profile.firma) {
        previewWrap.innerHTML = `
          <div style="font-size:12px;color:#666;margin-bottom:4px;">Firma actual:</div>
          <img src="${profile.firma}" alt="Firma actual" style="max-height:80px;border:1px solid #eee;border-radius:4px;background:white;padding:4px;">
        `;
      } else {
        previewWrap.innerHTML = '<div style="font-size:12px;color:#999;">Aún no hay firma registrada.</div>';
      }
    }
  } catch (err) {
    console.error('Error cargando perfil del doctor:', err);
  }
}

function initDoctorSignatureCanvas() {
  const canvas = document.getElementById('doctorSignatureCanvas');
  if (!canvas) return;
  // Ajustar resolución del canvas al tamaño real para evitar firma borrosa
  const ratio = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 500;
  const cssHeight = canvas.clientHeight || 180;
  canvas.width = Math.round(cssWidth * ratio);
  canvas.height = Math.round(cssHeight * ratio);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#1a237e';

  function getPos(evt) {
    const rect = canvas.getBoundingClientRect();
    if (evt.touches && evt.touches[0]) {
      return { x: evt.touches[0].clientX - rect.left, y: evt.touches[0].clientY - rect.top };
    }
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  function start(evt) {
    evt.preventDefault();
    __doctorSignatureCanvasState.drawing = true;
    const p = getPos(evt);
    __doctorSignatureCanvasState.lastX = p.x;
    __doctorSignatureCanvasState.lastY = p.y;
  }
  function move(evt) {
    if (!__doctorSignatureCanvasState.drawing) return;
    evt.preventDefault();
    const p = getPos(evt);
    ctx.beginPath();
    ctx.moveTo(__doctorSignatureCanvasState.lastX, __doctorSignatureCanvasState.lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    __doctorSignatureCanvasState.lastX = p.x;
    __doctorSignatureCanvasState.lastY = p.y;
  }
  function end() {
    __doctorSignatureCanvasState.drawing = false;
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseleave', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);
}

function clearDoctorSignatureCanvas() {
  const canvas = document.getElementById('doctorSignatureCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Reaplicar escala/estilo
  initDoctorSignatureCanvas();
}

// Detecta si el canvas tiene trazos (todos los píxeles con alpha 0 = vacío)
function isCanvasEmpty(canvas) {
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return false;
  }
  return true;
}

// Exporta firma reducida a PNG base64 con ancho máximo 400px (~ peso 50-100 KB)
function exportSignatureToBase64(canvas) {
  const targetWidth = 400;
  const aspect = canvas.height / canvas.width;
  const targetHeight = Math.round(targetWidth * aspect);
  const tmp = document.createElement('canvas');
  tmp.width = targetWidth;
  tmp.height = targetHeight;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
  return tmp.toDataURL('image/png');
}

async function saveDoctorSignature(doctorId) {
  if (!isCurrentUserAdmin()) {
    alert('Solo un administrador puede guardar la firma.');
    return;
  }
  const cmv = (document.getElementById('doctorCmvInput')?.value || '').trim();
  const pinInput = document.getElementById('doctorPinInput');
  const pinRaw = pinInput ? String(pinInput.value || '').trim() : '';
  const canvas = document.getElementById('doctorSignatureCanvas');
  if (!canvas) return;

  try {
    const snap = await firebase.database().ref(`doctors/${doctorId}`).once('value');
    const current = normalizeDoctorProfile(snap.val()) || { name: '', cmv: '', firma: '', pin: '' };
    if (!current.name) {
      alert('No se encontró el nombre del doctor. Recargue la lista e intente de nuevo.');
      return;
    }

    let firma = current.firma || '';
    if (!isCanvasEmpty(canvas)) {
      firma = exportSignatureToBase64(canvas);
    } else if (!firma) {
      // Sin firma nueva y sin firma previa: confirmar si solo guardará CMV
      if (!confirm('No ha dibujado una firma. ¿Desea guardar solo el CMV por ahora?')) {
        return;
      }
    }

    let pin = current.pin || '';
    if (pinRaw) {
      if (!/^\d{4,6}$/.test(pinRaw)) {
        alert('El PIN debe tener entre 4 y 6 dígitos numéricos.');
        return;
      }
      pin = pinRaw;
    } else if (!pin) {
      alert('Configure un PIN de 4 a 6 dígitos para autorizar recetas digitales.');
      return;
    }

    const updated = { name: current.name, cmv, firma, pin };
    await firebase.database().ref(`doctors/${doctorId}`).set(updated);
    alert('Firma, CMV y PIN guardados correctamente.');
    closeDoctorSignatureModal();
    loadDoctorsList();
  } catch (err) {
    console.error('Error guardando firma del doctor:', err);
    alert('Error al guardar: ' + err.message);
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
window.openDoctorSignatureModal = openDoctorSignatureModal;
window.closeDoctorSignatureModal = closeDoctorSignatureModal;
window.clearDoctorSignatureCanvas = clearDoctorSignatureCanvas;
window.saveDoctorSignature = saveDoctorSignature;
window.findDoctorProfileByName = findDoctorProfileByName;
window.normalizeDoctorProfile = normalizeDoctorProfile;