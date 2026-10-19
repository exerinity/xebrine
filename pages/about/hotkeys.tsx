const HOTKEYS: { chords: string[][]; action: string }[] = [
  { chords: [['Space'], ['K']], action: 'Play / pause' },
  { chords: [['F']], action: 'Toggle the fullscreen player' },
  { chords: [['Ctrl', 'F']], action: 'Focus the search bar' },
  { chords: [['R']], action: 'Restart the current track' },
  { chords: [['T']], action: 'Cycle repeat mode' },
  { chords: [['H']], action: 'Toggle shuffle' },
  { chords: [['Z']], action: 'Previous track' },
  { chords: [['X']], action: 'Next track' },
  { chords: [['Arrow Left'], ['J'], ['A']], action: 'Seek back 10s (Shift 1s / Ctrl 5s / Alt 30s)' },
  { chords: [['Arrow Right'], ['L'], ['D']], action: 'Seek forward 10s (Shift 1s / Ctrl 5s / Alt 30s)' },
  { chords: [['Arrow Up'], ['W']], action: 'Volume up' },
  { chords: [['Arrow Down'], ['S']], action: 'Volume down' },
  { chords: [['0 - 9']], action: 'Jump to 0 - 90% of the track (Shift nudges 5%)' },
  { chords: [['?']], action: 'Open this list' }
];

export function AboutHotkeys() {
  return (
    <table className="xe_hotkeys">
      <tbody>
        {HOTKEYS.map((row) => (
          <tr key={row.action}>
            <th scope="row">
              {row.chords.map((chord, chord_index) => (
                <span key={chord_index} className="xe_hotkeys__chord">
                  {chord_index > 0 && <span className="xe_hotkeys__sep">or</span>}
                  {chord.map((key, key_index) => (
                    <span key={key_index} className="xe_hotkeys__key">
                      {key_index > 0 && <span className="xe_hotkeys__plus">+</span>}
                      <kbd>{key}</kbd>
                    </span>
                  ))}
                </span>
              ))}
            </th>
            <td>{row.action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
