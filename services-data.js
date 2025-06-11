// services-data.js - Base de datos de servicios de laboratorio

const SERVICIOS_LABORATORIO = {
  perfiles: {
    titulo: "Perfiles Especializados",
    servicios: [
      {
        id: "perfil_quimico_general",
        nombre: "Perfil Químico General (Hg, Glu, Renal, Hepática, Alb, TP)",
        descripcion: "Evalúa funciones metabólicas y orgánicas básicas.",
        precio: 37000
      },
      {
        id: "perfil_renal_completo",
        nombre: "Perfil Renal Completo (Hg, Glu, Crea, Bun-Crea, Au, P, Mg, Urea, Orina, Electrólitos)",
        descripcion: "Evalúa la salud renal del paciente.",
        precio: 35000
      },
      {
        id: "perfil_hepatico_completo",
        nombre: "Perfil Hepático Completo (Hg, Glu, Renal, AST, ALT, GGT, ALP, P, Alb, TP, TBA, Urea, TG, TC, Glob, Glob-Alb, TBil, Dbil)",
        descripcion: "Analiza función hepática.",
        precio: 30000
      },
      {
        id: "perfil_prequirurgico",
        nombre: "Perfil Prequirúrgico (Hg, Glu, Renal, AST, ALT, Alb, TP, Tiempos de coagulación)",
        descripcion: "Evalúa parámetros esenciales antes de una cirugía.",
        precio: 38000
      },
      {
        id: "perfil_cachorro_completo",
        nombre: "Perfil Cachorro Completo (Hg, Urea, Crea, Alb, ALT, ALP, AST, Heces)",
        descripcion: "Diseñado para cachorros, es un conjunto de análisis clínicos diseñado específicamente para evaluar la función renal y la salud general de los cachorros.",
        precio: 38000
      },
      {
        id: "perfil_adulto_completo",
        nombre: "Perfil Adulto Completo (Hg, Renal, hepático, Alb, TP, CK, Orina, Heces)",
        descripcion: "Examen integral para adultos.",
        precio: 48000
      },
      {
        id: "perfil_adulto_basico",
        nombre: "Perfil Adulto Básico (Hg, Urea, Crea, ALT, AST, ALP, GGT, Glu, Alb, CK)",
        descripcion: "Versión simplificada del perfil adulto.",
        precio: 26000
      },
      {
        id: "perfil_cardiaco_completo",
        nombre: "Perfil Cardíaco Completo (Hg, AST, ALT, Alb, TP, CK)",
        descripcion: "Evalúa la función cardíaca mediante pruebas.",
        precio: 26000
      },
      {
        id: "perfil_pancreatico",
        nombre: "Perfil Pancreático Canino o Felino (Hg, Lipasa, Amilasa, AST, ALP, ALT, Glu, GGT, LDH, TBILL, TG, ALB)",
        descripcion: "Especializado en evaluar páncreas con pruebas.",
        precio: 30000
      }
    ]
  },
  paneles: {
    titulo: "Paneles de Laboratorio",
    servicios: [
      {
        id: "panel_plus",
        nombre: "Panel Plus (Alb, ALT, ALP, AMY, Bun, CA, Crea, Bun/Crea, Glob, Alb/Glob, P, TBILL, TP, CHOL, TBA, Electrolitos, glu)",
        descripcion: "Evaluación avanzada de albúmina, electrolitos, proteínas, lípidos y función hepática/renal.",
        precio: 25000
      },
      {
        id: "panel_general_basico",
        nombre: "Panel General Básico (Alb, ALP, ALT, AMY, Bun, Crea, Bun-Crea, Ca, Glob, Glo-Alb- Glu, TP, TC, CK, P, BillT)",
        descripcion: "Alternativa simplificada del Panel Plus, con enfoque en función renal, hepática.",
        precio: 23000
      },
      {
        id: "panel_electrolitos",
        nombre: "Panel Electrolitos (Cl, K, Na, Na-K, CO2, Ca, P, MG)",
        descripcion: "Mide niveles de sodio (Na), potasio (K), cloro (Cl), calcio (Ca), fósforo (P), magnesio (Mg) y otros.",
        precio: 18000
      },
      {
        id: "electrolitos_parvovirus",
        nombre: "Electrolitos para pacientes con Parvovirus (NA, K, CL)",
        descripcion: "Específico para pacientes con parvovirus, analiza los electrolitos más relevantes para su tratamiento.",
        precio: 5000
      },
      {
        id: "panel_intensivo_atropello",
        nombre: "Panel Intensivo Atropello (Hg, Glu, Renal, Hepatico)",
        descripcion: "Evaluación rápida para pacientes traumatizados por atropello, enfocado en daño orgánico.",
        precio: 28000
      },
      {
        id: "panel_flutd",
        nombre: "Panel FLUTD (Hg, Glu, Renal, Orina, SDMA)",
        descripcion: "Especializado para enfermedad del tracto urinario inferior felino, incluye biomarcador SDMA.",
        precio: 50000
      },
      {
        id: "panel_parvo_virus",
        nombre: "Panel Parvo virus (Hg, Glu, Renal, Hepático, Heces, Test CPV, Electrolitos)",
        descripcion: "Evaluación completa para pacientes con sospecha de parvovirosis, incluye test específico.",
        precio: 35000
      },
      {
        id: "panel_distemper",
        nombre: "Panel Distemper (Hg, Glu, Hepático, Alb, TP, Test CDV)",
        descripcion: "Evaluación para pacientes con sospecha de moquillo canino, incluye test específico para el virus.",
        precio: 30000
      }
    ]
  },
  transfusiones: {
    titulo: "Servicios de Transfusión",
    servicios: [
      {
        id: "tipificacion_dea1",
        nombre: "Tipificación DEA 1 Canino",
        descripcion: "Determina el grupo sanguíneo DEA 1 en perros, fundamental para transfusiones seguras.",
        precio: 28000
      },
      {
        id: "tipificacion_ab_felino",
        nombre: "Tipificación AB Felino",
        descripcion: "Determina el grupo sanguíneo (A, B o AB) en gatos, esencial antes de cualquier transfusión.",
        precio: 28000
      },
      {
        id: "compatibilidad_sanguinea",
        nombre: "Compatibilidad Sanguínea",
        descripcion: "Prueba cruzada que confirma la compatibilidad entre donante y receptor.",
        precio: 10000
      },
      {
        id: "bolsa_sangre_canina",
        nombre: "Bolsa de sangre canina 500ml + Venoclisis",
        descripcion: "Unidad de sangre completa canina con equipo de administración incluido.",
        precio: 45000
      },
      {
        id: "bolsa_sangre_felina",
        nombre: "Bolsa de sangre Felina 250ml + venoclisis",
        descripcion: "Unidad de sangre completa felina con equipo de administración incluido.",
        precio: 50000
      },
      {
        id: "procedimiento_transfusion",
        nombre: "Procedimiento transfusión",
        descripcion: "Servicio de administración de transfusión con monitorización del paciente.",
        precio: 30000
      },
      {
        id: "bolsa_plasma",
        nombre: "Bolsa Plasma 250ml + venoclisis",
        descripcion: "Unidad de plasma con equipo para pacientes que requieren factores de coagulación o proteínas.",
        precio: 30000
      },
      {
        id: "procedimiento_donador_completo",
        nombre: "Procedimiento donador: tipificación+anestesia+bolsa+hemograma",
        descripcion: "Proceso completo para donantes de primera vez, incluye tipificación y evaluación.",
        precio: 53000
      },
      {
        id: "procedimiento_donador_tipificado",
        nombre: "Procedimiento donador ya tipificado: anestesia+bolsa+hemograma",
        descripcion: "Proceso para donantes recurrentes ya tipificados previamente.",
        precio: 28000
      },
      {
        id: "combo_transfusion_canino",
        nombre: "Combo transfusión canino sin sangre (Tipificación DEA 1, procedimiento transfusión, compatibilidad, 2 hemogramas post-transfusión)",
        descripcion: "Paquete completo para transfusión canina, no incluye la bolsa de sangre.",
        precio: 80000
      },
      {
        id: "combo_transfusion_felino",
        nombre: "Combo transfusión felina sin sangre (Tipificación AB, procedimiento transfusión, compatibilidad, 2 hemogramas)",
        descripcion: "Paquete completo para transfusión felina, no incluye la bolsa de sangre.",
        precio: 80000
      }
    ]
  },
  tests: {
    titulo: "Tests y Diagnósticos Rápidos",
    servicios: [
      {
        id: "test_sida_leucemia",
        nombre: "Test sida leucemia",
        descripcion: "Prueba rápida para detectar virus de inmunodeficiencia felina y leucemia felina.",
        precio: 0,
        ubicacion: "Lab/Recep"
      },
      {
        id: "test_distemper",
        nombre: "Test Distemper",
        descripcion: "Prueba rápida para detección de antígeno de moquillo canino.",
        precio: 0,
        ubicacion: "Lab/Recep"
      },
      {
        id: "parvovirus_corona_giardia",
        nombre: "ParvoVirus+corona+giardia",
        descripcion: "Panel combinado para detección rápida de tres patógenos comunes en perros.",
        precio: 0,
        ubicacion: "Lab/Recep"
      },
      {
        id: "erhlichia_canis",
        nombre: "Erhlichia canis",
        descripcion: "Prueba para detectar anticuerpos contra la bacteria transmitida por garrapatas.",
        precio: 0,
        ubicacion: "Lab/Recep"
      },
      {
        id: "erhlichia_anaplasma",
        nombre: "Erhlichia canis + anaplasma",
        descripcion: "Panel combinado para detección de dos enfermedades transmitidas por garrapatas.",
        precio: 0,
        ubicacion: "Lab/Recep"
      },
      {
        id: "caniv4",
        nombre: "CaniV4",
        descripcion: "Panel de detección de 4 enfermedades caninas comunes.",
        precio: 0,
        ubicacion: "Lab/Recep"
      },
      {
        id: "parvovirus_corona",
        nombre: "Parvovirus+Corona",
        descripcion: "Prueba dual para detección simultánea de dos virus comunes en perros.",
        precio: 0,
        ubicacion: "Lab/Recep"
      },
      {
        id: "giardia",
        nombre: "Giardia",
        descripcion: "Detección de parásito protozoario intestinal común en mascotas.",
        precio: 0,
        ubicacion: "Lab/Recep"
      },
      {
        id: "giardia_cryptosporidium",
        nombre: "Giardia+Cryptosporidium",
        descripcion: "Panel para detección de dos parásitos intestinales comunes en mascotas.",
        precio: 0,
        ubicacion: "Lab/Recep"
      }
    ]
  },
  vcheck: {
    titulo: "Pruebas VCheck",
    servicios: [
      {
        id: "ctsh_vcheck",
        nombre: "CTSH (Vcheck)",
        descripcion: "Medición de hormona estimulante de tiroides canina mediante tecnología Vcheck.",
        precio: 0,
        ubicacion: "Lab/Recep"
      },
      {
        id: "t4_total_vcheck",
        nombre: "T4 Total (Vcheck)",
        descripcion: "Medición de tiroxina total mediante tecnología Vcheck.",
        precio: 0,
        ubicacion: "Lab/Recep"
      },
      {
        id: "fpl_vcheck",
        nombre: "FPL (Vcheck)",
        descripcion: "Lipasa pancreática felina, para diagnóstico de pancreatitis en gatos.",
        precio: 0,
        ubicacion: "Lab/Recep"
      },
      {
        id: "ag_distemper_vcheck",
        nombre: "AG. Distemper (Vcheck)",
        descripcion: "Detección de antígeno de distemper canino mediante tecnología Vcheck.",
        precio: 0,
        ubicacion: "Lab/Recep"
      },
      {
        id: "sdma_vcheck",
        nombre: "SDMA (Vcheck)",
        descripcion: "Dimetilarginina simétrica, biomarcador precoz de enfermedad renal.",
        precio: 0,
        ubicacion: "Lab/Recep"
      },
      {
        id: "cpl_vcheck",
        nombre: "CPL (Vcheck)",
        descripcion: "Lipasa pancreática canina, para diagnóstico de pancreatitis en perros.",
        precio: 0,
        ubicacion: "Lab/Recep"
      },
      {
        id: "cortisol_vcheck",
        nombre: "Cortisol (Vcheck)",
        descripcion: "Medición de cortisol mediante tecnología Vcheck.",
        precio: 0,
        ubicacion: "Lab/Recep"
      }
    ]
  },
  liquidos: {
    titulo: "Análisis de Líquidos",
    servicios: [
      {
        id: "test_rivalta",
        nombre: "Test rivalta+tira reactiva",
        descripcion: "Evaluación de líquidos corporales mediante prueba de Rivalta y análisis con tira reactiva.",
        precio: 5000
      },
      {
        id: "analisis_liquido_libre",
        nombre: "Análisis liquido libre (Directo, tinción gram, tinción Diff Quick, tira reactiva, opcional prueba Rivalta)",
        descripcion: "Evaluación completa de líquidos corporales mediante múltiples técnicas.",
        precio: 18000
      }
    ]
  },
  coagulacion: {
    titulo: "Estudios de Coagulación",
    servicios: [
      {
        id: "tiempos_coagulacion",
        nombre: "Tiempos de coagulación TP/ATTP (Tubo de citrato)",
        descripcion: "Evaluación de la capacidad de coagulación sanguínea.",
        precio: 17000
      }
    ]
  },
  hemograma: {
    titulo: "Estudios Hematológicos",
    servicios: [
      {
        id: "hemograma_basico",
        nombre: "Hemograma básico (sin frotis)",
        descripcion: "Análisis sanguíneo básico que incluye conteo celular automatizado.",
        precio: 15000
      },
      {
        id: "hemograma_completo",
        nombre: "Hemograma Completo (con frotis)",
        descripcion: "Análisis sanguíneo completo que incluye evaluación microscópica de células.",
        precio: 18000
      },
      {
        id: "hemograma_reticulosis",
        nombre: "Hemograma + conteo de reticulosis",
        descripcion: "Hemograma con evaluación adicional de precursores de glóbulos rojos.",
        precio: 18000
      },
      {
        id: "hemograma_control_reticulocitos",
        nombre: "Hemograma control + conteo de reticulocitos",
        descripcion: "Seguimiento de pacientes previos con evaluación de precursores de glóbulos rojos.",
        precio: 11000
      },
      {
        id: "frotis",
        nombre: "Frotis",
        descripcion: "Evaluación microscópica de células sanguíneas.",
        precio: 7000
      },
      {
        id: "hemograma_control",
        nombre: "Hemograma de control",
        descripcion: "Seguimiento de pacientes previamente diagnosticados.",
        precio: 7000
      },
      {
        id: "hemograma_control_frotis",
        nombre: "Hemograma de control con frotis",
        descripcion: "Seguimiento de pacientes con evaluación microscópica adicional.",
        precio: 9000
      },
      {
        id: "frotis_reticulocitos",
        nombre: "Frotis + conteo de reticulocitos",
        descripcion: "Evaluación microscópica con conteo específico de precursores de glóbulos rojos.",
        precio: 11000
      },
      {
        id: "frotis_reticulocitos_control",
        nombre: "Frotis + conteo de reticulocitos de control",
        descripcion: "Seguimiento de pacientes con evaluación específica de precursores de glóbulos rojos.",
        precio: 8000
      },
      {
        id: "conteo_reticulocitos",
        nombre: "Conteo de reticulocitos (Clasificación de Anemia)",
        descripcion: "Evaluación específica de precursores de glóbulos rojos para clasificar anemias.",
        precio: 6000
      }
    ]
  },
  quimica: {
    titulo: "Química Sanguínea Individual",
    servicios: [
      {
        id: "ggt",
        nombre: "GGT",
        descripcion: "",
        precio: 5000
      },
      {
        id: "glucosa",
        nombre: "Glucosa",
        descripcion: "",
        precio: 5000
      },
      {
        id: "trigliceridos",
        nombre: "Triglicéridos",
        descripcion: "",
        precio: 5000
      },
      {
        id: "hdl_c",
        nombre: "HDL-C",
        descripcion: "",
        precio: 5000
      },
      {
        id: "urea",
        nombre: "Urea",
        descripcion: "",
        precio: 5000
      },
      {
        id: "nitrogeno_ureico",
        nombre: "Nitrógeno Ureico (BUN)",
        descripcion: "",
        precio: 5000
      },
      {
        id: "creatinina",
        nombre: "Creatinina",
        descripcion: "",
        precio: 5000
      },
      {
        id: "combo_renal",
        nombre: "Combo (Crea+Bun+Urea+RelaciónBun/Crea+P)",
        descripcion: "",
        precio: 10000
      },
      {
        id: "acido_urico",
        nombre: "Ácido Úrico",
        descripcion: "",
        precio: 5000
      },
      {
        id: "fosforo",
        nombre: "Fósforo",
        descripcion: "",
        precio: 5000
      },
      {
        id: "calcio",
        nombre: "Calcio",
        descripcion: "",
        precio: 5000
      },
      {
        id: "magnesio",
        nombre: "Magnesio",
        descripcion: "",
        precio: 5000
      },
      {
        id: "ast",
        nombre: "AST",
        descripcion: "",
        precio: 5000
      },
      {
        id: "alt",
        nombre: "ALT",
        descripcion: "",
        precio: 5000
      },
      {
        id: "bilirrubina_directa",
        nombre: "Bilirrubina Directa",
        descripcion: "",
        precio: 5000
      },
      {
        id: "bilirrubina_indirecta",
        nombre: "Bilirrubina Indirecta",
        descripcion: "",
        precio: 5000
      },
      {
        id: "bilirrubina_total",
        nombre: "Bilirrubina Total",
        descripcion: "",
        precio: 5000
      },
      {
        id: "albumina",
        nombre: "Albúmina",
        descripcion: "",
        precio: 5000
      },
      {
        id: "proteinas_totales",
        nombre: "Proteínas Totales",
        descripcion: "",
        precio: 5000
      },
      {
        id: "ck",
        nombre: "CK",
        descripcion: "",
        precio: 5000
      },
      {
        id: "fosfatasa_alcalina",
        nombre: "Fosfatasa Alcalina (ALP)",
        descripcion: "",
        precio: 5000
      },
      {
        id: "tc",
        nombre: "TC",
        descripcion: "",
        precio: 5000
      }
    ]
  },
  plasma: {
    titulo: "Productos Plasmáticos",
    servicios: [
      {
        id: "gotero_plasma_fresco",
        nombre: "Gotero plasma fresco congelado (EDTA)",
        descripcion: "Se encuentran activos todos los factores de coagulación, plasma rico en plaquetas y rico en factores de crecimiento. Coadyuvante en el tratamiento de úlceras corneales.",
        precio: 5000
      },
      {
        id: "suero_autologo",
        nombre: "Suero Autólogo (ROJO)",
        descripcion: "Efectos beneficiosos en la reparación de lesiones sobre la superficie ocular, beneficiosas en los procesos de cicatrización epitelial y crecimiento celular",
        precio: 5000
      }
    ]
  },
  heces: {
    titulo: "Análisis de Heces",
    servicios: [
      {
        id: "examen_heces_general",
        nombre: "Examen de heces general",
        descripcion: "(Directo, sangre oculta, flotación)",
        precio: 9000
      },
      {
        id: "examen_heces_completo",
        nombre: "Examen de heces completo",
        descripcion: "(Directo, flotación, tinción, sangre oculta, Antígeno Giardia, Antígeno Cryptosporidium)",
        precio: 16000
      },
      {
        id: "examen_heces_seriado",
        nombre: "Examen de heces seriado",
        descripcion: "3 muestras/3 días (Directo, flotación, tinción, sangre oculta, Antígeno Giardia, Antígeno Cryptosporidium)",
        precio: 25000
      },
      {
        id: "sangre_oculta_heces",
        nombre: "Sangre oculta en heces",
        descripcion: "",
        precio: 2000
      }
    ]
  },
  orina: {
    titulo: "Análisis de Orina",
    servicios: [
      {
        id: "urinalisis_15_parametros",
        nombre: "Urianálisis (15 parámetros)",
        descripcion: "LEU, URO, ALB, PRO, BIL, GLU, ASC, SG, KET, NIT, CREA, PH, BLO, CA",
        precio: 8000
      },
      {
        id: "urinalisis_11_parametros",
        nombre: "Urianálisis (11 parámetros)",
        descripcion: "LEU, URO, PRO, BIL, GLU, ASC, SG, KET, NIT, PH, BLO",
        precio: 7000
      },
      {
        id: "tira_reactiva_15",
        nombre: "Tira reactiva (15 parámetros)",
        descripcion: "LEU, URO, ALB, PRO, BIL, GLU, ASC, SG, KET, NIT, CREA, PH, BLO, CA",
        precio: 1500
      },
      {
        id: "tira_reactiva_11",
        nombre: "Tira reactiva (11 parámetros)",
        descripcion: "LEU, URO, PRO, BIL, GLU, ASC, SG, KET, NIT, PH, BLO",
        precio: 1000
      }
    ]
  },
  dermatologia: {
    titulo: "Estudios Dermatológicos",
    servicios: [
      {
        id: "frotis_raspado_gram",
        nombre: "Frotis Raspado de Piel (Tinción de Gram)",
        descripcion: "",
        precio: 8000
      },
      {
        id: "frotis_raspado_koh",
        nombre: "Frotis Raspado de Piel (KOH)",
        descripcion: "",
        precio: 8000
      },
      {
        id: "frotis_raspado_combo",
        nombre: "Frotis Raspado de Piel (Combo: Tinción de Gram, KOH)",
        descripcion: "",
        precio: 13000
      },
      {
        id: "frotis_raspado_completo",
        nombre: "Frotis Raspado de Piel (Combo: Tinción de Gram, KOH, Cultivo Dermatofitos)",
        descripcion: "",
        precio: 25000
      },
      {
        id: "cultivo_dermatofitos",
        nombre: "Cultivo Dermatofitos",
        descripcion: "",
        precio: 15000
      },
      {
        id: "hisopado",
        nombre: "Hisopado",
        descripcion: "",
        precio: 8000
      }
    ]
  }
};

// Función para obtener todos los servicios en formato plano
function getAllServices() {
  const allServices = [];
  Object.keys(SERVICIOS_LABORATORIO).forEach(categoryKey => {
    const category = SERVICIOS_LABORATORIO[categoryKey];
    category.servicios.forEach(servicio => {
      allServices.push({
        ...servicio,
        categoria: categoryKey,
        categoriaTitulo: category.titulo
      });
    });
  });
  return allServices;
}

// Función para buscar servicios por término
function searchServices(term) {
  const allServices = getAllServices();
  const searchTerm = term.toLowerCase();
  
  return allServices.filter(servicio => 
    servicio.nombre.toLowerCase().includes(searchTerm) ||
    servicio.descripcion.toLowerCase().includes(searchTerm) ||
    servicio.categoriaTitulo.toLowerCase().includes(searchTerm)
  );
}

// Función para obtener servicio por ID
function getServiceById(serviceId) {
  const allServices = getAllServices();
  return allServices.find(servicio => servicio.id === serviceId);
}

// Función para formatear precio en colones
function formatPrice(price) {
  if (price === 0) return 'Consultar precio';
  return `₡${price.toLocaleString('es-CR')}`;
}
