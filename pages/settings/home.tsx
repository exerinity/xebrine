import { useSettings } from '../../context/settings_context';
import { HOME_SECTION_IDS, HOME_SECTION_LABELS, moveHomeSection, type HomeSectionId } from '../../utils/home_sections';
import { useDragReorder } from '../../hooks/drag_reorder';

export function HomeSettings({ show_heading }: { show_heading: boolean }) {
  const { settings, update } = useSettings();

  const moveHomeSectionByKey = (id: HomeSectionId, direction: number) => {
    const currentIndex = settings.homeSections.indexOf(id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= settings.homeSections.length) return;
    const next = [...settings.homeSections];
    [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
    update({ homeSections: next });
  };
  const {
    listRef: homeSectionListRef,
    dragging: homeSectionDragging,
    handleProps: homeSectionHandleProps,
    itemStyle: homeSectionItemStyle
  } = useDragReorder((from, to) => {
    const source = settings.homeSections[from];
    const target = settings.homeSections[to];
    if (!source || !target) return;
    update({
      homeSections: moveHomeSection(settings.homeSections, source, target, to > from)
    });
  });

  return (
    <>
      {show_heading && <h2 className="xe_settings__category-heading">Home layout</h2>}
      <section className="xe_settings__section">
        <h2>Home sections</h2>
        <p className="xe_settings__hint" id="home-sections-help">
          Drag the handles to change the order. You can also use the arrow keys while a handle is focused
        </p>
        <div className="xe_settings__home-list" ref={homeSectionListRef} role="list">
          {settings.homeSections.map((id, index) => {
            const label = HOME_SECTION_LABELS[id];
            return (
              <div
                key={id}
                role="listitem"
                className={`xe_settings__home-item${homeSectionDragging?.from === index
                    ? ' xe_settings__home-item--dragging'
                    : ''
                  }`}
                style={homeSectionItemStyle(index)}
              >
                <div className="xe_settings__home-item-head">
                  <button
                    type="button"
                    className="xe_settings__home-drag"
                    aria-label={`Reorder ${label}`}
                    aria-describedby="home-sections-help"
                    title={`Drag to reorder ${label}`}
                    {...homeSectionHandleProps(index)}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                        event.preventDefault();
                        moveHomeSectionByKey(id, event.key === 'ArrowUp' ? -1 : 1);
                      }
                    }}
                  >
                    <svg viewBox="0 0 12 18" width="12" height="18" aria-hidden="true">
                      <circle cx="3" cy="3" r="1.5" />
                      <circle cx="9" cy="3" r="1.5" />
                      <circle cx="3" cy="9" r="1.5" />
                      <circle cx="9" cy="9" r="1.5" />
                      <circle cx="3" cy="15" r="1.5" />
                      <circle cx="9" cy="15" r="1.5" />
                    </svg>
                  </button>
                  <span className="xe_settings__home-label">{label}</span>
                  <button
                    type="button"
                    className="xe_settings__home-remove"
                    onClick={() => update({ homeSections: settings.homeSections.filter((sectionId) => sectionId !== id) })}
                    aria-label={`Remove ${label} from Home`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {settings.homeSections.length === 0 && (
          <p className="xe_settings__hint">No sections are shown on Home</p>
        )}
        {HOME_SECTION_IDS.some((id) => !settings.homeSections.includes(id)) && (
          <div className="xe_settings__home-add">
            <span className="xe_settings__home-add-label">Add a section</span>
            <div className="xe_settings__home-add-options">
              {HOME_SECTION_IDS.filter((id) => !settings.homeSections.includes(id)).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="xe_btn xe_btn--quiet"
                  onClick={() => update({ homeSections: [...settings.homeSections, id] })}
                >
                  + {HOME_SECTION_LABELS[id]}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
