import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './board-fix.css';
import { puzzles as puzzleData } from './puzzles.js';

const SIZE = 13;
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

function buildGrid(words) {
  const placements = [], cells = new Map();
  const key = (r, c) => `${r},${c}`;
  const canPlace = (word, row, col, direction) => {
    const dr = direction === 'down' ? 1 : 0, dc = direction === 'across' ? 1 : 0;
    if (cells.has(key(row - dr, col - dc)) || cells.has(key(row + dr * word.length, col + dc * word.length))) return false;
    let crossings = 0;
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return false;
      const existing = cells.get(key(r, c));
      if (existing && existing.letter !== word[i]) return false;
      if (existing) crossings++;
      if (!existing) {
        const sides = direction === 'across' ? [[r - 1, c], [r + 1, c]] : [[r, c - 1], [r, c + 1]];
        if (sides.some(([sr, sc]) => cells.has(key(sr, sc)))) return false;
      }
    }
    return placements.length === 0 || crossings > 0;
  };
  const place = ([word, clue], row, col, direction) => {
    const id = placements.length, dr = direction === 'down' ? 1 : 0, dc = direction === 'across' ? 1 : 0, coords = [];
    [...word].forEach((letter, i) => {
      const r = row + dr * i, c = col + dc * i, k = key(r, c);
      const cell = cells.get(k) || { letter, row: r, col: c, entries: [] };
      cell.entries.push(id); cells.set(k, cell); coords.push(k);
    });
    placements.push({ id, word, clue, direction, row, col, coords });
  };
  place(words[0], 6, Math.floor((SIZE - words[0][0].length) / 2), 'across');
  for (const item of words.slice(1)) {
    let found;
    for (const placed of placements) {
      for (let wi = 0; wi < item[0].length && !found; wi++) for (let pi = 0; pi < placed.word.length && !found; pi++) {
        if (item[0][wi] !== placed.word[pi]) continue;
        const direction = placed.direction === 'across' ? 'down' : 'across';
        const [cr, cc] = placed.coords[pi].split(',').map(Number);
        const row = cr - (direction === 'down' ? wi : 0), col = cc - (direction === 'across' ? wi : 0);
        if (canPlace(item[0], row, col, direction)) found = { row, col, direction };
      }
      if (found) break;
    }
    if (found) place(item, found.row, found.col, found.direction);
  }
  const ordered = [...placements].sort((a, b) => a.row - b.row || a.col - b.col || (a.direction === 'across' ? -1 : 1));
  let number = 0; const starts = new Map();
  ordered.forEach(p => { const k = key(p.row, p.col); if (!starts.has(k)) starts.set(k, ++number); p.number = starts.get(k); });
  const occupied = [...cells.values()];
  const minRow = Math.max(0, Math.min(...occupied.map(cell => cell.row)) - 1);
  const maxRow = Math.min(SIZE - 1, Math.max(...occupied.map(cell => cell.row)) + 1);
  const minCol = Math.max(0, Math.min(...occupied.map(cell => cell.col)) - 1);
  const maxCol = Math.min(SIZE - 1, Math.max(...occupied.map(cell => cell.col)) + 1);
  return {
    cells,
    placements,
    bounds: { minRow, maxRow, minCol, maxCol },
    rows: maxRow - minRow + 1,
    cols: maxCol - minCol + 1
  };
}

const Icon = ({ children }) => <span aria-hidden="true">{children}</span>;

function App() {
  const [puzzles] = useState(puzzleData), [selected, setSelected] = useState(puzzleData[0]);
  const [screen, setScreen] = useState('home'), [answers, setAnswers] = useState({}), [active, setActive] = useState(null);
  const [activeEntry, setActiveEntry] = useState(0), [message, setMessage] = useState(''), [menu, setMenu] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false), [solvedPuzzle, setSolvedPuzzle] = useState(null), [seconds, setSeconds] = useState(0), [coins, setCoins] = useState(120);
  const cellRefs = useRef({});
  const completionHandled = useRef(false);

  const grid = useMemo(() => selected ? buildGrid(selected.words) : null, [selected]);
  const completed = JSON.parse(localStorage.getItem('crossword-completed') || '[]');
  useEffect(() => {
    if (!selected || !grid) return;
    setAnswers(JSON.parse(sessionStorage.getItem(`crossword-${selected.id}`) || '{}'));
    completionHandled.current = false;
    setActive(grid.placements[0]?.coords[0]); setActiveEntry(grid.placements[0]?.id || 0); setMessage(''); setSeconds(0);
  }, [selected, grid]);
  useEffect(() => { if (selected) sessionStorage.setItem(`crossword-${selected.id}`, JSON.stringify(answers)); }, [answers, selected]);
  useEffect(() => { if (screen !== 'game') return; const timer = setInterval(() => setSeconds(s => s + 1), 1000); return () => clearInterval(timer); }, [screen]);
  useEffect(() => {
    if (!selected || !grid || screen !== 'game' || completionHandled.current) return;
    const entries = [...grid.cells];
    const complete = entries.length > 0 && entries.every(([key, cell]) => answers[key] === cell.letter);
    if (!complete) return;
    completionHandled.current = true;
    const solveTime = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    const record = { id: selected.id, title: selected.title, theme: selected.theme, date: new Date().toISOString(), time: solveTime };
    const saved = JSON.parse(localStorage.getItem('crossword-completed') || '[]');
    localStorage.setItem('crossword-completed', JSON.stringify([record, ...saved.filter(item => item.id !== selected.id)]));
    sessionStorage.removeItem(`crossword-${selected.id}`);
    setCoins(value => value + 30);
    setMessage('');
    setSolvedPuzzle(record);
  }, [answers, grid, screen, seconds, selected]);

  if (!selected || !grid) return <div className="splash"><div className="logo-burst">C</div><b>CluePop</b></div>;
  const current = grid.placements.find(p => p.id === activeEntry) || grid.placements[0];
  const filled = [...grid.cells.keys()].filter(k => answers[k]).length;
  const wrongCount = [...grid.cells].filter(([key, cell]) => answers[key] && answers[key] !== cell.letter).length;
  const progress = Math.round(filled / grid.cells.size * 100);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  const openPuzzle = p => {
    if (p.id === selected.id) {
      setAnswers(JSON.parse(sessionStorage.getItem(`crossword-${p.id}`) || '{}'));
      completionHandled.current = false;
      setSeconds(0);
      setActive(grid.placements[0]?.coords[0]);
      setActiveEntry(grid.placements[0]?.id || 0);
    }
    setSelected(p); setScreen('game'); window.scrollTo(0, 0);
  };
  const chooseCell = k => {
    const cell = grid.cells.get(k);
    if (active === k && cell.entries.length > 1) setActiveEntry(cell.entries.find(id => id !== activeEntry) ?? cell.entries[0]);
    else { setActive(k); setActiveEntry(cell.entries.includes(activeEntry) ? activeEntry : cell.entries[0]); }
  };
  const focusKey = k => { setActive(k); requestAnimationFrame(() => cellRefs.current[k]?.focus()); };
  const inputLetter = letter => {
    if (!active) return;
    if (letter === 'BACK') {
      if (answers[active]) setAnswers(a => ({ ...a, [active]: '' }));
      else { const i = current.coords.indexOf(active); if (i > 0) focusKey(current.coords[i - 1]); }
      return;
    }
    setAnswers(a => ({ ...a, [active]: letter }));
    const i = current.coords.indexOf(active), next = current.coords.slice(i + 1).find(k => !answers[k]) || current.coords[i + 1];
    if (next) focusKey(next);
  };
  const handleKey = e => {
    if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); inputLetter(e.key.toUpperCase()); }
    if (e.key === 'Backspace') { e.preventDefault(); inputLetter('BACK'); }
  };
  const hintLetter = () => {
    if (coins < 10) return setMessage('You need 10 coins for a letter hint.');
    const k = current.coords.find(x => !answers[x] || answers[x] !== grid.cells.get(x).letter) || active;
    setAnswers(a => ({ ...a, [k]: grid.cells.get(k).letter })); setCoins(c => c - 10); setMessage('A letter has been revealed!');
  };
  const hintWord = () => {
    if (coins < 25) return setMessage('You need 25 coins for a word hint.');
    setAnswers(a => ({ ...a, ...Object.fromEntries(current.coords.map((k, i) => [k, current.word[i]])) }));
    setCoins(c => c - 25); setMessage('Word revealed!');
  };
  return <div className="app-frame" onKeyDown={handleKey}>
    {screen === 'home' ? <>
      <header className="home-header">
        <button className="round-btn" onClick={() => setMenu(!menu)} aria-label="Open menu"><Icon>☰</Icon></button>
        <div className="wordmark"><div className="logo-burst">C</div><span>Clue<b>Pop</b></span></div>
        <button className="coin-pill" onClick={() => setArchiveOpen(true)}><Icon>★</Icon> {coins}</button>
      </header>
      {menu && <div className="quick-menu"><button onClick={() => setArchiveOpen(true)}>🏆 Solved collection</button><button onClick={() => setMenu(false)}>⚙️ Settings</button></div>}
      <main className="home-main">
        <section className="welcome"><div><p>Wednesday, October 14</p><h1>Ready for your<br/><em>daily word break?</em></h1></div><div className="streak"><b>3</b><span>🔥 day<br/>streak</span></div></section>
        <div className="date-strip" aria-label="Daily calendar">{['S','M','T','W','T','F','S'].map((d,i) => <div className={i === 3 ? 'today' : ''} key={i}><small>{d}</small><b>{11+i}</b>{i < 3 && <span>✓</span>}</div>)}</div>
        <section className="daily-card">
          <div className="card-art"><div className="film">▰</div><div className="star">★</div><div className="ticket">ADMIT ONE</div></div>
          <div className="daily-copy"><span className="tag">TODAY'S PUZZLE</span><p>Movie Wednesday</p><h2>{puzzles[0].title}</h2><small>Easy · 5–8 min</small><button onClick={() => openPuzzle(puzzles[0])}>{completed.some(x => x.id === puzzles[0].id) ? 'Play again' : 'Play now'} <Icon>▶</Icon></button></div>
        </section>
        <section className="packs-head"><div><span className="mini-label">MORE TO EXPLORE</span><h2>Pick a theme</h2></div><button onClick={() => setArchiveOpen(true)}>View solved</button></section>
        <section className="pack-grid">{puzzles.map((p, i) => { const solved = completed.some(x => x.id === p.id); return <button className={`pack-card pack-${i} ${solved ? 'is-solved' : ''}`} key={p.id} onClick={() => openPuzzle(p)}>
          <span className="pack-icon">{['🎬','🎵','🌍','🍋'][i]}</span><span className="pack-progress">{solved ? '✓ SOLVED' : `${Math.max(0, Object.keys(JSON.parse(sessionStorage.getItem(`crossword-${p.id}`) || '{}')).length)} filled`}</span><small>{p.theme}</small><b>{p.title}</b><i>{solved ? 'Play again ↻' : 'Play puzzle →'}</i>
        </button>})}</section>
      </main>
      <nav className="bottom-nav"><button className="active"><Icon>⌂</Icon><span>Home</span></button><button onClick={() => openPuzzle(puzzles[1])}><Icon>▦</Icon><span>Puzzles</span></button><button onClick={() => setArchiveOpen(true)}><Icon>♛</Icon><span>Collection</span></button></nav>
    </> : <main className="game-screen" style={{ '--theme': selected.color }}>
      <header className="game-top"><button onClick={() => setScreen('home')} aria-label="Back home">‹</button><div><small>{selected.theme.toUpperCase()} · EASY</small><b>{selected.title}</b></div><span className="timer">◷ {time}</span><span className="game-coins">★ {coins}</span><button onClick={() => setMenu(!menu)} aria-label="Puzzle menu">•••</button></header>
      <div className="game-progress"><i style={{ width: `${progress}%` }}/></div>
      <section className="play-area">
        <div className="board" role="grid" aria-label={`${selected.title} crossword`} style={{ '--board-ratio': grid.cols / grid.rows, gridTemplateColumns: `repeat(${grid.cols}, 1fr)`, gridTemplateRows: `repeat(${grid.rows}, 1fr)`, aspectRatio: `${grid.cols} / ${grid.rows}` }}>{Array.from({ length: grid.rows * grid.cols }, (_, i) => {
          const r = grid.bounds.minRow + Math.floor(i / grid.cols), c = grid.bounds.minCol + (i % grid.cols), k = `${r},${c}`, cell = grid.cells.get(k);
          if (!cell) return <div className="block" key={k}/>;
          const start = grid.placements.find(p => p.coords[0] === k), inWord = current.coords.includes(k);
          const wrong = answers[k] && answers[k] !== cell.letter;
          return <button tabIndex={active === k ? 0 : -1} key={k} ref={el => cellRefs.current[k] = el} className={`cell ${active === k ? 'selected' : ''} ${inWord ? 'in-word' : ''} ${wrong ? 'wrong' : ''}`} onClick={() => chooseCell(k)}>
            {start && <small>{start.number}</small>}<span>{answers[k]}</span>
          </button>;
        })}</div>
      </section>
      <section className="clue-bar" onClick={() => { const ids = current.coords.flatMap(k => grid.cells.get(k).entries); const unique = [...new Set(ids)]; if (unique.length > 1) setActiveEntry(unique.find(id => id !== activeEntry) ?? activeEntry); }}>
        <button onClick={e => { e.stopPropagation(); const i = grid.placements.indexOf(current); const p = grid.placements[(i - 1 + grid.placements.length) % grid.placements.length]; setActiveEntry(p.id); focusKey(p.coords[0]); }}>‹</button>
        <p><b>{current.number}{current.direction === 'across' ? 'A' : 'D'}</b><span>{current.clue}</span></p>
        <button onClick={e => { e.stopPropagation(); const i = grid.placements.indexOf(current); const p = grid.placements[(i + 1) % grid.placements.length]; setActiveEntry(p.id); focusKey(p.coords[0]); }}>›</button>
      </section>
      {message && <div className="toast" role="status">{message}<button onClick={() => setMessage('')}>×</button></div>}
      <section className="tool-row"><button onClick={hintLetter}><Icon>💡</Icon><span>Letter<small>★ 10</small></span></button><button onClick={hintWord}><Icon>✨</Icon><span>Word<small>★ 25</small></span></button><div className={`error-counter ${wrongCount ? 'has-errors' : ''}`} role="status" aria-live="polite"><Icon>{wrongCount ? '!' : '✓'}</Icon><span>Errors<small>{wrongCount}</small></span></div></section>
      <section className="keyboard" aria-label="On-screen keyboard">{KEY_ROWS.map((row, i) => <div key={row}>{[...row].map(k => <button key={k} onClick={() => inputLetter(k)}>{k}</button>)}{i === 2 && <button className="backspace" onClick={() => inputLetter('BACK')}>⌫</button>}</div>)}</section>
    </main>}
    {archiveOpen && <div className="modal-backdrop" onClick={() => setArchiveOpen(false)}><aside className="collection" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setArchiveOpen(false)}>×</button><div className="trophy">🏆</div><span className="mini-label">YOUR TROPHY CASE</span><h2>Solved puzzles</h2>{completed.length ? completed.map(x => <div className="solved-row" key={x.id}><span>✓</span><div><b>{x.title}</b><small>{x.theme} · {new Date(x.date).toLocaleDateString()} {x.time ? `· ${x.time}` : ''}</small></div></div>) : <p className="empty">Complete your first puzzle and it’ll be saved right here.</p>}</aside></div>}
    {solvedPuzzle && <div className="modal-backdrop celebration-backdrop"><aside className="celebration" role="dialog" aria-modal="true" aria-labelledby="congrats-title">
      <div className="confetti" aria-hidden="true"><i>◆</i><i>●</i><i>★</i><i>■</i><i>●</i><i>▲</i></div>
      <div className="celebration-trophy">🏆</div><span className="mini-label">PUZZLE COMPLETE</span><h2 id="congrats-title">Congrats!</h2><p>You solved <b>{solvedPuzzle.title}</b> in {solvedPuzzle.time}.</p><div className="reward">★ <b>+30</b> coins</div>
      <button className="celebration-primary" onClick={() => { setSolvedPuzzle(null); setScreen('home'); window.scrollTo(0, 0); }}>Back to puzzles</button>
      <button className="celebration-secondary" onClick={() => { setSolvedPuzzle(null); setArchiveOpen(true); }}>View collection</button>
    </aside></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
