/**
 * Tema visual unificado para gráficas de estadísticas (Chart.js)
 */
(function () {
    const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

    const PALETTE = [
        '#4285F4', '#34A853', '#FBBC04', '#EA4335', '#673AB7',
        '#00ACC1', '#FF7043', '#8BC34A', '#5C6BC0', '#26A69A',
        '#AB47BC', '#29B6F6', '#66BB6A', '#FFA726', '#EF5350'
    ];

    const GRADIENT_STOPS = [
        ['#4285F4', '#669DF6'],
        ['#34A853', '#5BB974'],
        ['#FBBC04', '#FDD663'],
        ['#EA4335', '#F07167'],
        ['#673AB7', '#9575CD'],
        ['#00ACC1', '#4DD0E1'],
        ['#FF7043', '#FFAB91'],
        ['#5C6BC0', '#7986CB'],
        ['#26A69A', '#4DB6AC'],
        ['#AB47BC', '#CE93D8']
    ];

    function destroyChart(instanceKey) {
        const chart = window[instanceKey];
        if (!chart) return;
        try { chart.destroy(); } catch (_) { /* noop */ }
        window[instanceKey] = null;
    }

    function showEmpty(canvas, message) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.clientWidth || canvas.width || 300;
        const h = canvas.clientHeight || canvas.height || 200;
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, w, h);
        ctx.font = `13px ${FONT}`;
        ctx.fillStyle = '#6c757d';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(message, w / 2, h / 2);
    }

    function getColors(count) {
        return Array.from({ length: count }, (_, i) => PALETTE[i % PALETTE.length]);
    }

    function createBarGradient(ctx, index) {
        const [start, end] = GRADIENT_STOPS[index % GRADIENT_STOPS.length];
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, start);
        gradient.addColorStop(1, end);
        return gradient;
    }


    function hexToRgba(hex, alpha) {
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16);
        const g = parseInt(h.substring(2, 4), 16);
        const b = parseInt(h.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function baseTooltip() {
        return {
            backgroundColor: 'rgba(33, 37, 41, 0.94)',
            titleFont: { family: FONT, size: 13, weight: '600' },
            bodyFont: { family: FONT, size: 12 },
            padding: 12,
            cornerRadius: 8,
            boxPadding: 4,
            displayColors: true
        };
    }

    function baseLegend(position = 'top') {
        return {
            position,
            labels: {
                font: { family: FONT, size: 11 },
                padding: 14,
                usePointStyle: true,
                pointStyle: 'circle',
                boxWidth: 8
            }
        };
    }

    function gridScales(showX = true, showY = true, horizontal = false) {
        const gridColor = 'rgba(0, 0, 0, 0.06)';
        const tickColor = '#6c757d';
        const common = {
            grid: { color: gridColor, drawBorder: false },
            ticks: { font: { family: FONT, size: 11 }, color: tickColor },
            border: { display: false }
        };
        if (horizontal) {
            return {
                x: { ...common, beginAtZero: true, grid: { ...common.grid, display: showX } },
                y: { ...common, grid: { display: false } }
            };
        }
        return {
            x: { ...common, grid: { display: false } },
            y: { ...common, beginAtZero: true, grid: { ...common.grid, display: showY } }
        };
    }

    function baseOptions(overrides = {}) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 700, easing: 'easeOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: baseLegend(),
                tooltip: baseTooltip()
            },
            ...overrides
        };
    }

    function doughnutOptions(total, subtext = 'Total') {
        return baseOptions({
            cutout: '62%',
            plugins: {
                legend: baseLegend('bottom'),
                tooltip: {
                    ...baseTooltip(),
                    callbacks: {
                        label(context) {
                            const value = context.raw || 0;
                            const sum = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = sum ? Math.round((value / sum) * 100) : 0;
                            return ` ${context.label}: ${value} (${pct}%)`;
                        }
                    }
                },
                centerText: { text: String(total), subtext }
            }
        });
    }

    const centerTextPlugin = {
        id: 'centerText',
        beforeDraw(chart, _args, opts) {
            if (!opts || opts.text == null) return;
            const { ctx, chartArea } = chart;
            if (!chartArea) return;
            const cx = (chartArea.left + chartArea.right) / 2;
            const cy = (chartArea.top + chartArea.bottom) / 2;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `700 26px ${FONT}`;
            ctx.fillStyle = '#2c3e50';
            ctx.fillText(opts.text, cx, cy - 8);
            ctx.font = `500 12px ${FONT}`;
            ctx.fillStyle = '#6c757d';
            ctx.fillText(opts.subtext || '', cx, cy + 16);
            ctx.restore();
        }
    };

    let pluginRegistered = false;

    function ensurePlugins() {
        if (pluginRegistered || typeof Chart === 'undefined') return;
        Chart.register(centerTextPlugin);
        pluginRegistered = true;
    }

    function loadChartJS() {
        if (!window.lazyLoadLibs || typeof window.lazyLoadLibs.loadChartJS !== 'function') {
            return Promise.reject(new Error('lazyLoadLibs no disponible'));
        }
        return window.lazyLoadLibs.loadChartJS().then(() => {
            ensurePlugins();
        });
    }

    function createChart(instanceKey, canvas, config) {
        if (!canvas) return Promise.resolve(null);
        destroyChart(instanceKey);
        return loadChartJS().then(() => {
            const ctx = canvas.getContext('2d');
            window[instanceKey] = new Chart(ctx, config);
            return window[instanceKey];
        });
    }

    function percentTooltipLabel() {
        return {
            callbacks: {
                label(context) {
                    const value = context.raw || 0;
                    const sum = context.dataset.data.reduce((a, b) => a + b, 0);
                    const pct = sum ? ((value / sum) * 100).toFixed(1) : 0;
                    return ` ${context.label || context.dataset.label}: ${value} (${pct}%)`;
                }
            }
        };
    }

    window.StatsCharts = {
        PALETTE,
        FONT,
        destroyChart,
        showEmpty,
        getColors,
        createBarGradient,
        hexToRgba,
        baseOptions,
        baseTooltip,
        baseLegend,
        gridScales,
        doughnutOptions,
        loadChartJS,
        createChart,
        percentTooltipLabel
    };
})();
