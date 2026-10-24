import { useState, useEffect, useMemo, useRef } from 'react';
import {
  HARDWARE_BOARDS,
  ChamberSimulation,
  type BoardSpec,
  type SimulationParams,
  type ViewMode
} from './ChamberSimulation';
import './App.css';

function BoardCadPreview({ board }: { board: BoardSpec }) {
  const [w, d] = board.dimensions;
  const scale = 24;
  const svgW = w * scale;
  const svgH = d * scale;

  return (
    <svg
      viewBox={`${-svgW / 2 - 12} ${-svgH / 2 - 12} ${svgW + 24} ${svgH + 24}`}
      className="rl-cad-svg"
    >
      <rect
        x={-svgW / 2}
        y={-svgH / 2}
        width={svgW}
        height={svgH}
        rx={6}
        fill={board.substrateHex}
        stroke="#475569"
        strokeWidth={1.5}
      />
      {[
        [-svgW / 2 + 8, -svgH / 2 + 8],
        [svgW / 2 - 8, -svgH / 2 + 8],
        [-svgW / 2 + 8, svgH / 2 - 8],
        [svgW / 2 - 8, svgH / 2 - 8]
      ].map(([cx, cy], idx) => (
        <circle
          key={idx}
          cx={cx}
          cy={cy}
          r={3.5}
          fill="#0b0c0e"
          stroke="#d4af37"
          strokeWidth={1.8}
        />
      ))}
      {board.traces.map((t) => {
        const pts = t.points.map(([px, pz]) => `${px * scale},${pz * scale}`).join(' ');
        return (
          <polyline
            key={t.id}
            points={pts}
            fill="none"
            stroke={t.isPower ? '#f59e0b' : '#38bdf8'}
            strokeWidth={t.isPower ? 2.2 : 1.4}
            strokeOpacity={0.75}
          />
        );
      })}
      {board.components.map((c) => {
        const [cx, cz] = c.position;
        const [cw, , cd] = c.size;
        const rw = cw * scale;
        const rh = cd * scale;
        return (
          <g key={c.id} transform={`translate(${cx * scale}, ${cz * scale})`}>
            <rect
              x={-rw / 2}
              y={-rh / 2}
              width={rw}
              height={rh}
              rx={2}
              fill={
                c.packageType === 'MODULE'
                  ? '#94a3b8'
                  : c.packageType === 'USB'
                  ? '#cbd5e1'
                  : c.packageType === 'LED'
                  ? '#10b981'
                  : '#18181b'
              }
              stroke="#94a3b8"
              strokeWidth={0.9}
            />
            <text
              x={0}
              y={2.5}
              textAnchor="middle"
              fill="#f8fafc"
              fontSize="6.5"
              fontFamily="monospace"
            >
              {c.designator}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<'hub' | 'workspace'>('hub');
  const [selectedBoardId, setSelectedBoardId] = useState<string>(HARDWARE_BOARDS[0].id);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    HARDWARE_BOARDS[0].components[0].id
  );
  const [hubSearch, setHubSearch] = useState('');
  const [hubCategory, setHubCategory] = useState<string>('ALL');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'gcode' | 'json'>('gcode');

  const currentBoard: BoardSpec = useMemo(
    () => HARDWARE_BOARDS.find((b) => b.id === selectedBoardId) || HARDWARE_BOARDS[0],
    [selectedBoardId]
  );

  const [simParams, setSimParams] = useState<SimulationParams>({
    running: true,
    supplyVoltage: HARDWARE_BOARDS[0].nominalVcc,
    clockScale: 1.0,
    loadPercent: 65,
    ambientTemp: 26.0,
    viewMode: 'physical',
    showToolpath: false,
    activeWaypointIndex: 0
  });

  const oscCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleSelectBoard = (board: BoardSpec) => {
    setSelectedBoardId(board.id);
    setSelectedComponentId(board.components[0]?.id || null);
    setSimParams((prev) => ({
      ...prev,
      supplyVoltage: board.nominalVcc,
      activeWaypointIndex: 0
    }));
    setActiveTab('workspace');
  };

  const allWaypoints = useMemo(() => {
    const list: Array<{
      index: number;
      compId: string;
      designator: string;
      componentName: string;
      x: number;
      z: number;
      action: 'SOLDER' | 'INSPECT' | 'PROBE';
      dwellMs: number;
    }> = [];
    currentBoard.components.forEach((c) => {
      c.waypoints.forEach((wp) => {
        list.push({
          index: list.length,
          compId: c.id,
          designator: c.designator,
          componentName: c.name,
          x: wp.x,
          z: wp.z,
          action: wp.action,
          dwellMs: wp.dwellMs
        });
      });
    });
    return list;
  }, [currentBoard]);

  useEffect(() => {
    if (!simParams.showToolpath || !simParams.running || allWaypoints.length === 0) return;
    const timer = setInterval(() => {
      setSimParams((prev) => ({
        ...prev,
        activeWaypointIndex: (prev.activeWaypointIndex + 1) % allWaypoints.length
      }));
    }, 1400);
    return () => clearInterval(timer);
  }, [simParams.showToolpath, simParams.running, allWaypoints.length]);

  const metrics = useMemo(() => {
    const vRatio = simParams.supplyVoltage / currentBoard.nominalVcc;
    const activeFactor = simParams.running
      ? (simParams.loadPercent / 100) * simParams.clockScale
      : 0.05;
    const totalCurrentMa = currentBoard.components.reduce(
      (sum, c) => sum + c.baseCurrentMa * vRatio * (0.35 + 0.65 * activeFactor),
      0
    );
    const totalPowerMw = totalCurrentMa * simParams.supplyVoltage;

    const componentMetrics = new Map<
      string,
      {
        currentMa: number;
        powerMw: number;
        tempC: number;
        status: 'NOMINAL' | 'ELEVATED' | 'OVERVOLT';
      }
    >();

    let peakTempC = simParams.ambientTemp;
    currentBoard.components.forEach((c) => {
      const cMa = c.baseCurrentMa * vRatio * (0.35 + 0.65 * activeFactor);
      const pMw = cMa * simParams.supplyVoltage;
      const tempC = simParams.ambientTemp + pMw * c.thermalResistance * 0.12;
      if (tempC > peakTempC) peakTempC = tempC;

      let status: 'NOMINAL' | 'ELEVATED' | 'OVERVOLT' = 'NOMINAL';
      if (simParams.supplyVoltage > currentBoard.maxVcc) status = 'OVERVOLT';
      else if (tempC > 68) status = 'ELEVATED';

      componentMetrics.set(c.id, { currentMa: cMa, powerMw: pMw, tempC, status });
    });

    return {
      totalCurrentMa,
      totalPowerMw,
      peakTempC,
      componentMetrics
    };
  }, [currentBoard, simParams]);

  const selectedComponent = useMemo(
    () => currentBoard.components.find((c) => c.id === selectedComponentId) || null,
    [currentBoard, selectedComponentId]
  );

  useEffect(() => {
    if (activeTab !== 'workspace') return;
    const canvas = oscCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phase = 0;

    const renderScope = () => {
      animId = requestAnimationFrame(renderScope);
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#090a0d';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#181b22';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      if (simParams.running) {
        phase += 0.09 * simParams.clockScale;
      }

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const clk = Math.sin(x * 0.14 * simParams.clockScale + phase) >= 0 ? -9 : 9;
        const y = h * 0.32 + clk;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const duty = simParams.loadPercent / 100;
      for (let x = 0; x < w; x++) {
        const cycle = ((x * 0.04 + phase * 0.5) % (Math.PI * 2)) / (Math.PI * 2);
        const pwm = cycle < duty ? -8 : 8;
        const y = h * 0.72 + pwm;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    renderScope();
    return () => cancelAnimationFrame(animId);
  }, [activeTab, simParams.running, simParams.clockScale, simParams.loadPercent]);

  const filteredBoards = useMemo(() => {
    return HARDWARE_BOARDS.filter((b) => {
      const matchesCat = hubCategory === 'ALL' || b.category === hubCategory;
      const q = hubSearch.trim().toLowerCase();
      const matchesQuery =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.architecture.toLowerCase().includes(q) ||
        b.summary.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [hubCategory, hubSearch]);

  const exportPayload = useMemo(() => {
    if (exportFormat === 'gcode') {
      const header = [
        `; REFLOWLAB INDUSTRIAL ROBOTIC EXPORT`,
        `; TARGET_BOARD: ${currentBoard.name} (${currentBoard.revision})`,
        `; DIMENSIONS_MM: ${(currentBoard.dimensions[0] * 10).toFixed(1)} x ${(currentBoard.dimensions[1] * 10).toFixed(1)}`,
        `G21 ; Millimeter units`,
        `G90 ; Absolute positioning`,
        `M104 S350 ; Set reflow nozzle / tip temp 350C`,
        `G00 Z15.00 F1200 ; Safe Z clearance`
      ];
      const steps = allWaypoints.map(
        (wp) =>
          `G01 X${(wp.x * 10).toFixed(2)} Y${(wp.z * 10).toFixed(2)} Z1.60 F850 ; ${wp.designator} ${wp.action}\nG04 P${wp.dwellMs}\nG00 Z8.00`
      );
      return [...header, ...steps, `G00 X0.00 Y0.00 Z25.00`, `M30`].join('\n');
    }

    return JSON.stringify(
      {
        schema: 'reflowlab.robotics.v1',
        boardId: currentBoard.id,
        boardName: currentBoard.name,
        revision: currentBoard.revision,
        nominalVcc: currentBoard.nominalVcc,
        waypoints: allWaypoints.map((wp) => ({
          step: wp.index + 1,
          designator: wp.designator,
          action: wp.action,
          coordinatesMm: {
            x: +(wp.x * 10).toFixed(2),
            y: +(wp.z * 10).toFixed(2),
            z: 1.6
          },
          dwellMs: wp.dwellMs
        }))
      },
      null,
      2
    );
  }, [exportFormat, currentBoard, allWaypoints]);

  const handleDownloadExport = () => {
    const blob = new Blob([exportPayload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reflowlab-${currentBoard.id}.${exportFormat === 'gcode' ? 'gcode' : 'json'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bt-shell">
      <header className="bt-topbar">
        <div className="bt-brand-group">
          <div className="bt-logo-mark">RL</div>
          <span className="bt-brand-title">ReflowLab</span>
          <span className="bt-version-tag">3D HARDWARE HUB & SIMULATOR</span>
          <div className="bt-divider-v" />
          <nav className="bt-nav-tabs">
            <button
              className={`bt-tab-btn ${activeTab === 'hub' ? 'active' : ''}`}
              onClick={() => setActiveTab('hub')}
            >
              Board Hub ({HARDWARE_BOARDS.length} Popular Boards)
            </button>
            <button
              className={`bt-tab-btn ${activeTab === 'workspace' ? 'active' : ''}`}
              onClick={() => setActiveTab('workspace')}
            >
              3D Simulation Workbench
            </button>
          </nav>
        </div>

        <div className="bt-topbar-center">
          <span className="bt-active-board-label">BOARD:</span>
          <select
            className="rl-board-select"
            value={currentBoard.id}
            onChange={(e) => {
              const found = HARDWARE_BOARDS.find((b) => b.id === e.target.value);
              if (found) handleSelectBoard(found);
            }}
          >
            {HARDWARE_BOARDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.revision})
              </option>
            ))}
          </select>
          <span className="bt-badge-mono">{currentBoard.layers}L FR4</span>
        </div>

        <div className="bt-topbar-actions">
          {activeTab === 'workspace' && (
            <>
              <div className="bt-segmented">
                {(['physical', 'xray', 'thermal', 'exploded'] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={`bt-seg-btn ${simParams.viewMode === mode ? 'active' : ''}`}
                    onClick={() => setSimParams((p) => ({ ...p, viewMode: mode }))}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>

              <button
                className={`bt-btn ${simParams.showToolpath ? 'bt-btn-accent' : ''}`}
                onClick={() => setSimParams((p) => ({ ...p, showToolpath: !p.showToolpath }))}
              >
                Robot Toolpath
              </button>
            </>
          )}

          <button className="bt-btn bt-btn-primary" onClick={() => setExportModalOpen(true)}>
            Export Robot File
          </button>
        </div>
      </header>

      {activeTab === 'hub' ? (
        <main className="bt-hub-container">
          <div className="bt-hub-header">
            <div>
              <div className="rl-hub-eyebrow">REFLOWLAB OPEN HARDWARE LIBRARY</div>
              <h1 className="bt-hub-title">Popular Reference Boards for 3D Simulation</h1>
              <p className="bt-hub-subtitle">
                Choose a verified digital twin below to inspect 3D component geometry, stress-test voltage rails & thermal dissipation, or export robotic reflow & soldering instructions.
              </p>
            </div>
            <div className="bt-hub-controls">
              <input
                type="text"
                className="bt-input"
                placeholder="Search Arduino, ESP32, RP2040, STM32..."
                value={hubSearch}
                onChange={(e) => setHubSearch(e.target.value)}
              />
              <div className="bt-segmented">
                {[
                  'ALL',
                  'Microcontroller',
                  'Wireless IoT',
                  'Industrial Control',
                  'Power Systems',
                  'Avionics'
                ].map((cat) => (
                  <button
                    key={cat}
                    className={`bt-seg-btn ${hubCategory === cat ? 'active' : ''}`}
                    onClick={() => setHubCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bt-hub-grid">
            {filteredBoards.map((board) => {
              const isCurrent = board.id === currentBoard.id;
              return (
                <div key={board.id} className={`bt-board-card ${isCurrent ? 'selected' : ''}`}>
                  <div className="rl-card-preview-box" onClick={() => handleSelectBoard(board)}>
                    <BoardCadPreview board={board} />
                    <span className="rl-preview-badge">{board.architecture}</span>
                  </div>

                  <div className="bt-card-top">
                    <div>
                      <span className="bt-card-category">{board.category}</span>
                      <h3 className="bt-card-title">{board.name}</h3>
                    </div>
                    <span className="bt-badge-mono">{board.revision}</span>
                  </div>

                  <p className="bt-card-desc">{board.summary}</p>

                  <div className="bt-card-specs">
                    <div className="bt-spec-cell">
                      <span className="bt-spec-label">SIZE</span>
                      <span className="bt-spec-val">
                        {(board.dimensions[0] * 10).toFixed(0)}×{(board.dimensions[1] * 10).toFixed(0)}mm
                      </span>
                    </div>
                    <div className="bt-spec-cell">
                      <span className="bt-spec-label">STACKUP</span>
                      <span className="bt-spec-val">{board.layers} Layers</span>
                    </div>
                    <div className="bt-spec-cell">
                      <span className="bt-spec-label">RAIL</span>
                      <span className="bt-spec-val">{board.nominalVcc.toFixed(1)}V DC</span>
                    </div>
                    <div className="bt-spec-cell">
                      <span className="bt-spec-label">CLOCK</span>
                      <span className="bt-spec-val">{board.clockMhz} MHz</span>
                    </div>
                  </div>

                  <div className="bt-card-footer">
                    <span className="bt-card-meta">
                      ★ {board.stars} • {board.components.length} ICs/Parts • {board.remixes} Twins
                    </span>
                    <button
                      className="bt-btn bt-btn-primary"
                      onClick={() => handleSelectBoard(board)}
                    >
                      Simulate in 3D →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      ) : (
        <main className="bt-workspace-grid">
          <aside className="bt-panel bt-panel-left">
            <div className="bt-panel-section">
              <div className="bt-section-header">
                <span>SIMULATION PARAMETERS</span>
                <button
                  className={`bt-status-pill ${simParams.running ? 'running' : 'paused'}`}
                  onClick={() => setSimParams((p) => ({ ...p, running: !p.running }))}
                >
                  {simParams.running ? 'RUNNING' : 'PAUSED'}
                </button>
              </div>

              <div className="bt-control-group">
                <div className="bt-control-row">
                  <label>DC Rail Voltage (VCC)</label>
                  <span className="bt-mono-val">{simParams.supplyVoltage.toFixed(2)} V</span>
                </div>
                <input
                  type="range"
                  min="2.5"
                  max="6.5"
                  step="0.1"
                  value={simParams.supplyVoltage}
                  onChange={(e) =>
                    setSimParams((p) => ({ ...p, supplyVoltage: parseFloat(e.target.value) }))
                  }
                />
              </div>

              <div className="bt-control-group">
                <div className="bt-control-row">
                  <label>MCU / Load Duty Cycle</label>
                  <span className="bt-mono-val">{simParams.loadPercent}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={simParams.loadPercent}
                  onChange={(e) =>
                    setSimParams((p) => ({ ...p, loadPercent: parseInt(e.target.value, 10) }))
                  }
                />
              </div>

              <div className="bt-control-group">
                <div className="bt-control-row">
                  <label>Clock Frequency Scale</label>
                  <span className="bt-mono-val">
                    {(currentBoard.clockMhz * simParams.clockScale).toFixed(0)} MHz (
                    {simParams.clockScale.toFixed(1)}x)
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={simParams.clockScale}
                  onChange={(e) =>
                    setSimParams((p) => ({ ...p, clockScale: parseFloat(e.target.value) }))
                  }
                />
              </div>

              <div className="bt-control-group">
                <div className="bt-control-row">
                  <label>Chamber Ambient Temp</label>
                  <span className="bt-mono-val">{simParams.ambientTemp.toFixed(1)} °C</span>
                </div>
                <input
                  type="range"
                  min="18"
                  max="60"
                  step="1"
                  value={simParams.ambientTemp}
                  onChange={(e) =>
                    setSimParams((p) => ({ ...p, ambientTemp: parseFloat(e.target.value) }))
                  }
                />
              </div>
            </div>

            <div className="bt-panel-section bt-bom-section">
              <div className="bt-section-header">
                <span>BOM COMPONENT TREE ({currentBoard.components.length})</span>
                <span className="bt-muted-hint">Click to inspect</span>
              </div>
              <div className="bt-bom-list">
                {currentBoard.components.map((comp) => {
                  const m = metrics.componentMetrics.get(comp.id);
                  const active = comp.id === selectedComponentId;
                  return (
                    <button
                      key={comp.id}
                      className={`bt-bom-row ${active ? 'active' : ''}`}
                      onClick={() => setSelectedComponentId(comp.id)}
                    >
                      <span className="bt-bom-des">{comp.designator}</span>
                      <div className="bt-bom-info">
                        <span className="bt-bom-name">{comp.name}</span>
                        <span className="bt-bom-pkg">
                          {comp.packageType} • {comp.pins} Pins
                        </span>
                      </div>
                      <span className={`bt-bom-temp ${m && m.tempC > 65 ? 'warn' : ''}`}>
                        {m ? `${m.tempC.toFixed(1)}°C` : '--'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="bt-center-stage">
            <div className="bt-viewport-wrapper">
              <div className="bt-viewport-hud-top">
                <div className="bt-hud-metric">
                  <span className="bt-hud-label">BUS VOLTAGE</span>
                  <span className="bt-hud-value">{simParams.supplyVoltage.toFixed(2)} V</span>
                </div>
                <div className="bt-hud-metric">
                  <span className="bt-hud-label">TOTAL CURRENT</span>
                  <span className="bt-hud-value">{metrics.totalCurrentMa.toFixed(0)} mA</span>
                </div>
                <div className="bt-hud-metric">
                  <span className="bt-hud-label">BOARD POWER</span>
                  <span className="bt-hud-value">{(metrics.totalPowerMw / 1000).toFixed(2)} W</span>
                </div>
                <div className="bt-hud-metric">
                  <span className="bt-hud-label">PEAK JUNCTION</span>
                  <span className={`bt-hud-value ${metrics.peakTempC > 68 ? 'text-warn' : ''}`}>
                    {metrics.peakTempC.toFixed(1)} °C
                  </span>
                </div>
              </div>

              <ChamberSimulation
                board={currentBoard}
                simParams={simParams}
                selectedComponentId={selectedComponentId}
                onSelectComponent={setSelectedComponentId}
              />

              <div className="bt-viewport-hud-bottom">
                <span>LMB: Orbit • RMB: Pan • Scroll: Zoom • Click IC: Inspect Telemetry</span>
                <span>MODE: {simParams.viewMode.toUpperCase()}</span>
              </div>
            </div>

            <div className="bt-bottom-telemetry">
              <div className="bt-scope-box">
                <div className="bt-scope-meta">
                  <span className="bt-section-title">LIVE LOGIC & PWM OSCILLOSCOPE</span>
                  <div className="bt-scope-legend">
                    <span className="legend-clk">CH1: SYS_CLK</span>
                    <span className="legend-pwm">CH2: PWM_GATE</span>
                  </div>
                </div>
                <canvas ref={oscCanvasRef} width={520} height={74} className="bt-scope-canvas" />
              </div>

              <div className="bt-nets-box">
                <div className="bt-section-header">
                  <span>ACTIVE COPPER NETS ({currentBoard.traces.length})</span>
                </div>
                <div className="bt-nets-table">
                  {currentBoard.traces.map((t) => (
                    <div key={t.id} className="bt-net-row">
                      <span className="bt-net-name">{t.netName}</span>
                      <span className="bt-net-type">{t.isPower ? 'POWER' : 'SIGNAL'}</span>
                      <span className="bt-net-width">{(t.width * 10).toFixed(2)} mm</span>
                      <span className="bt-net-state">{simParams.running ? 'ACTIVE' : 'IDLE'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <aside className="bt-panel bt-panel-right">
            <div className="bt-panel-section">
              <div className="bt-section-header">
                <span>COMPONENT INSPECTOR</span>
                {selectedComponent && (
                  <span className="bt-badge-mono">{selectedComponent.designator}</span>
                )}
              </div>

              {selectedComponent ? (
                <div className="bt-inspector-body">
                  <h3 className="bt-insp-title">{selectedComponent.name}</h3>
                  <span className="bt-insp-cat">{selectedComponent.category}</span>
                  <p className="bt-insp-desc">{selectedComponent.description}</p>

                  {(() => {
                    const m = metrics.componentMetrics.get(selectedComponent.id);
                    return (
                      <div className="bt-insp-grid">
                        <div className="bt-insp-cell">
                          <span className="bt-spec-label">PACKAGE</span>
                          <span className="bt-spec-val">
                            {selectedComponent.packageType}-{selectedComponent.pins}
                          </span>
                        </div>
                        <div className="bt-insp-cell">
                          <span className="bt-spec-label">OPERATING RAIL</span>
                          <span className="bt-spec-val">
                            {selectedComponent.nominalVoltage.toFixed(1)} V
                          </span>
                        </div>
                        <div className="bt-insp-cell">
                          <span className="bt-spec-label">CURRENT DRAW</span>
                          <span className="bt-spec-val">
                            {m ? `${m.currentMa.toFixed(1)} mA` : '--'}
                          </span>
                        </div>
                        <div className="bt-insp-cell">
                          <span className="bt-spec-label">DISSIPATION</span>
                          <span className="bt-spec-val">
                            {m ? `${m.powerMw.toFixed(0)} mW` : '--'}
                          </span>
                        </div>
                        <div className="bt-insp-cell">
                          <span className="bt-spec-label">JUNCTION TEMP</span>
                          <span className="bt-spec-val">
                            {m ? `${m.tempC.toFixed(1)} °C` : '--'}
                          </span>
                        </div>
                        <div className="bt-insp-cell">
                          <span className="bt-spec-label">STATUS</span>
                          <span className={`bt-spec-val status-${m?.status.toLowerCase()}`}>
                            {m?.status || 'NOMINAL'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="bt-empty-inspector">
                  Select any IC, connector, or passive component in the 3D viewport or BOM tree to inspect live telemetry.
                </div>
              )}
            </div>

            <div className="bt-panel-section bt-waypoints-section">
              <div className="bt-section-header">
                <span>ROBOTIC TOOLPATH QUEUE</span>
                <span className="bt-badge-mono">{allWaypoints.length} STEPS</span>
              </div>

              <div className="bt-waypoint-list">
                {allWaypoints.map((wp) => {
                  const isCurrentStep =
                    simParams.showToolpath && simParams.activeWaypointIndex === wp.index;
                  return (
                    <div
                      key={`${wp.compId}-${wp.index}`}
                      className={`bt-wp-row ${isCurrentStep ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedComponentId(wp.compId);
                        setSimParams((p) => ({
                          ...p,
                          showToolpath: true,
                          activeWaypointIndex: wp.index
                        }));
                      }}
                    >
                      <span className="bt-wp-idx">#{wp.index + 1}</span>
                      <div className="bt-wp-main">
                        <span className="bt-wp-title">
                          {wp.designator} • {wp.action}
                        </span>
                        <span className="bt-wp-coords">
                          X:{(wp.x * 10).toFixed(1)}mm Y:{(wp.z * 10).toFixed(1)}mm
                        </span>
                      </div>
                      <span className="bt-wp-dwell">{wp.dwellMs}ms</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </main>
      )}

      {exportModalOpen && (
        <div className="bt-modal-backdrop" onClick={() => setExportModalOpen(false)}>
          <div className="bt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bt-modal-header">
              <div>
                <h2 className="bt-modal-title">ReflowLab Robotic Toolpath Exporter</h2>
                <p className="bt-modal-subtitle">
                  Target Twin: {currentBoard.name} ({currentBoard.revision})
                </p>
              </div>
              <div className="bt-segmented">
                <button
                  className={`bt-seg-btn ${exportFormat === 'gcode' ? 'active' : ''}`}
                  onClick={() => setExportFormat('gcode')}
                >
                  ISO G-Code (.gcode)
                </button>
                <button
                  className={`bt-seg-btn ${exportFormat === 'json' ? 'active' : ''}`}
                  onClick={() => setExportFormat('json')}
                >
                  6-DOF Kinematic JSON
                </button>
              </div>
            </div>

            <pre className="bt-code-preview">{exportPayload}</pre>

            <div className="bt-modal-footer">
              <button className="bt-btn" onClick={() => setExportModalOpen(false)}>
                Close
              </button>
              <button className="bt-btn bt-btn-primary" onClick={handleDownloadExport}>
                Download File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;