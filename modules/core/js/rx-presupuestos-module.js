/* Control RX y Presupuestos (carga bajo demanda por fecha) */
(function () {
  const RX_KEYWORDS = [
    "rx",
    "r.x",
    "rayos x",
    "rayos-x",
    "radiografia",
    "radiografía",
    "rx control",
    "rx de control",
    "control rx",
    "rx torax",
    "rx tórax"
  ];

  const PRESUPUESTO_KEYWORDS = [
    "presupuesto",
    "cotizacion",
    "cotización",
    "proforma",
    "estimado"
  ];

  function detectarTipo(texto) {
    const lower = (texto || "").toLowerCase();
    const esRX = RX_KEYWORDS.some(function (k) { return lower.includes(k); });
    const esPresupuesto = PRESUPUESTO_KEYWORDS.some(function (k) { return lower.includes(k); });
    if (esRX && esPresupuesto) return "ambos";
    if (esRX) return "rx";
    if (esPresupuesto) return "presupuesto";
    return null;
  }

  function extraerItems(ticket) {
    if (!ticket || !ticket.porCobrar) return [];
    const lines = String(ticket.porCobrar).split("\n");
    const items = [];

    lines.forEach(function (line, idx) {
      const trimmed = line.trim();
      if (!trimmed) return;
      const tipo = detectarTipo(trimmed);
      if (!tipo) return;

      items.push({
        lineIndex: idx,
        texto: trimmed,
        tipo: tipo,
        firebaseKey: ticket.firebaseKey || "",
        ticketId: ticket.id || "",
        paciente: ticket.mascota || "N/A",
        cliente: ticket.nombre || "N/A",
        cedula: ticket.cedula || "",
        fechaConsulta: ticket.fechaConsulta || ""
      });
    });

    if (items.length === 0) {
      const tipoFallback = detectarTipo(ticket.porCobrar);
      if (tipoFallback) {
        items.push({
          lineIndex: 0,
          texto: String(ticket.porCobrar).trim().substring(0, 300),
          tipo: tipoFallback,
          firebaseKey: ticket.firebaseKey || "",
          ticketId: ticket.id || "",
          paciente: ticket.mascota || "N/A",
          cliente: ticket.nombre || "N/A",
          cedula: ticket.cedula || "",
          fechaConsulta: ticket.fechaConsulta || ""
        });
      }
    }

    return items;
  }

  async function cargarTicketsPorFecha(fecha) {
    const db = window.database || (window.firebase && firebase.database ? firebase.database() : null);
    if (!db || !fecha) return [];

    const snap = await db.ref("tickets")
      .orderByChild("fechaConsulta")
      .equalTo(fecha)
      .once("value");

    const raw = snap.val() || {};
    const tickets = [];
    Object.keys(raw).forEach(function (key) {
      tickets.push(Object.assign({}, raw[key] || {}, { firebaseKey: key }));
    });
    return tickets;
  }

  function getTipoLabel(tipo) {
    if (tipo === "ambos") return "RX + Presupuesto";
    if (tipo === "rx") return "RX";
    if (tipo === "presupuesto") return "Presupuesto";
    return "N/A";
  }

  function formatTimestamp(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("es-CR");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function updateResumen(items, savedChecks) {
    const total = items.length;
    let checked = 0;

    items.forEach(function (item) {
      const checkKey = (item.firebaseKey || "nokey") + "_" + item.lineIndex;
      if (savedChecks[checkKey] && savedChecks[checkKey].enSistema) {
        checked += 1;
      }
    });

    const pending = total - checked;

    const totalEl = document.getElementById("rxTotalCount");
    const checkedEl = document.getElementById("rxCheckedCount");
    const pendingEl = document.getElementById("rxPendingCount");
    const badgeEl = document.getElementById("rxPresupuestosCount");
    const summaryBar = document.getElementById("rxSummaryBar");

    if (totalEl) totalEl.textContent = String(total);
    if (checkedEl) checkedEl.textContent = String(checked);
    if (pendingEl) pendingEl.textContent = String(pending);

    if (badgeEl) {
      badgeEl.style.display = "inline-flex";
      badgeEl.textContent = total + " item(s)";
    }

    if (summaryBar) {
      summaryBar.style.display = "grid";
    }
  }

  function setEmptyStateRow(tbody, message) {
    tbody.innerHTML = '<tr><td colspan="9" class="rx-empty">' + message + "</td></tr>";
  }

  async function cargarControl() {
    const fechaInput = document.getElementById("fechaRxPresupuestos");
    const tbody = document.getElementById("rxPresupuestosBody");
    const summaryBar = document.getElementById("rxSummaryBar");
    const badgeEl = document.getElementById("rxPresupuestosCount");
    if (!tbody) return;

    const fecha = (fechaInput && fechaInput.value) ? fechaInput.value : "";
    if (!fecha) {
      setEmptyStateRow(tbody, "Seleccione una fecha para realizar la busqueda.");
      if (summaryBar) summaryBar.style.display = "none";
      if (badgeEl) badgeEl.style.display = "none";
      return;
    }

    setEmptyStateRow(tbody, "Cargando resultados...");

    try {
      const ticketsDia = await cargarTicketsPorFecha(fecha);
      const items = [];

      ticketsDia.forEach(function (ticket) {
        extraerItems(ticket).forEach(function (item) {
          items.push(item);
        });
      });

      const checksSnap = await firebase.database()
        .ref("rx_presupuestos_checks/" + fecha)
        .once("value");
      const savedChecks = checksSnap.val() || {};

      tbody.innerHTML = "";
      if (items.length === 0) {
        setEmptyStateRow(tbody, "No se encontraron items RX o Presupuestos para la fecha seleccionada.");
        if (summaryBar) summaryBar.style.display = "none";
        if (badgeEl) badgeEl.style.display = "none";
        return;
      }

      items.forEach(function (item) {
        const checkKey = (item.firebaseKey || "nokey") + "_" + item.lineIndex;
        const saved = savedChecks[checkKey] || {};
        const enSistema = !!saved.enSistema;
        const tr = document.createElement("tr");
        const textoEscapado = escapeHtml(item.texto);

        tr.innerHTML =
          "<td>" + escapeHtml(item.ticketId || "-") + "</td>" +
          "<td>" + escapeHtml(item.cedula || "-") + "</td>" +
          "<td>" + escapeHtml(item.cliente || "N/A") + "</td>" +
          "<td>" + escapeHtml(item.paciente || "N/A") + "</td>" +
          '<td><span class="rx-tipo rx-' + item.tipo + '">' + getTipoLabel(item.tipo) + "</span></td>" +
          '<td class="rx-desc-cell" title="' + textoEscapado + '">' + textoEscapado + "</td>" +
          '<td><label class="rx-check-wrap"><input type="checkbox" data-check-key="' + checkKey + '" data-fecha="' + fecha + '"' + (enSistema ? " checked" : "") + ' onchange="rxPresupuestosToggleCheck(this)"><span>' + (enSistema ? "En sistema" : "Pendiente") + "</span></label></td>" +
          '<td><input type="text" class="rx-encargado-input" data-check-key="' + checkKey + '" data-fecha="' + fecha + '" value="' + escapeHtml(saved.encargado || saved.actualizadoPor || "") + '" placeholder="Nombre encargado" onchange="rxPresupuestosGuardarEncargado(this)" onblur="rxPresupuestosGuardarEncargado(this)"></td>' +
          '<td class="rx-updated-cell">' + formatTimestamp(saved.timestamp) + "</td>";

        tbody.appendChild(tr);
      });

      updateResumen(items, savedChecks);
    } catch (error) {
      console.error("Error cargando control RX/Presupuestos:", error);
      setEmptyStateRow(tbody, "Error al cargar datos. Intente nuevamente.");
      if (summaryBar) summaryBar.style.display = "none";
      if (badgeEl) badgeEl.style.display = "none";
    }
  }

  window.rxPresupuestosToggleCheck = function (checkbox) {
    const checkKey = checkbox.getAttribute("data-check-key");
    const fecha = checkbox.getAttribute("data-fecha");
    const enSistema = checkbox.checked;
    const ahora = new Date();
    const encargadoInput = document.querySelector(
      '.rx-encargado-input[data-check-key="' + checkKey + '"][data-fecha="' + fecha + '"]'
    );
    const encargado = encargadoInput ? encargadoInput.value.trim() : "";

    const label = checkbox.parentElement ? checkbox.parentElement.querySelector("span") : null;
    if (label) label.textContent = enSistema ? "En sistema" : "Pendiente";

    firebase.database()
      .ref("rx_presupuestos_checks/" + fecha + "/" + checkKey)
      .set({
        enSistema: enSistema,
        encargado: encargado,
        timestamp: ahora.toISOString(),
        actualizadoPor: sessionStorage.getItem("userName") || "Admin"
      })
      .then(function () {
        cargarControl();
      })
      .catch(function (error) {
        console.error("No se pudo guardar el check RX/Presupuesto:", error);
      });
  };

  window.rxPresupuestosGuardarEncargado = function (input) {
    const checkKey = input.getAttribute("data-check-key");
    const fecha = input.getAttribute("data-fecha");
    const encargado = (input.value || "").trim();
    const ahora = new Date();

    if (!checkKey || !fecha) return;

    firebase.database()
      .ref("rx_presupuestos_checks/" + fecha + "/" + checkKey)
      .update({
        encargado: encargado,
        timestamp: ahora.toISOString(),
        actualizadoPor: sessionStorage.getItem("userName") || "Admin"
      })
      .then(function () {
        const row = input.closest("tr");
        const updatedCell = row ? row.querySelector(".rx-updated-cell") : null;
        if (updatedCell) {
          updatedCell.textContent = formatTimestamp(ahora.toISOString());
        }
      })
      .catch(function (error) {
        console.error("No se pudo guardar el encargado RX/Presupuesto:", error);
      });
  };

  function getTodayLocalISO() {
    const now = new Date();
    const local = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
    return local.toISOString().split("T")[0];
  }

  function init() {
    const buscarBtn = document.getElementById("buscarRxPresupuestosBtn");
    const fechaInput = document.getElementById("fechaRxPresupuestos");

    if (fechaInput && !fechaInput.value) {
      fechaInput.value = getTodayLocalISO();
    }

    if (buscarBtn && !buscarBtn._rxInitialized) {
      buscarBtn.addEventListener("click", cargarControl);
      buscarBtn._rxInitialized = true;
    }

    if (fechaInput && !fechaInput._rxEnterInitialized) {
      fechaInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          cargarControl();
        }
      });
      fechaInput._rxEnterInitialized = true;
    }
  }

  window.initRxPresupuestosModule = init;
  window.cargarControlRxPresupuestos = cargarControl;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
