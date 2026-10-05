import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLibrary } from '../context/library_context';
import { useSettings } from '../context/settings_context';
import { usePlayer } from '../src/context/player';
import { intelligentShuffle } from '../queue/shuffle';
import { getRecentIds } from '../queue/history';
import { groupAlbums, albumKey } from '../utils/groups';
import { useAlbumArt } from '../hooks/album_art';
import { useTrackMenu } from '../hooks/track_menu';
import { useDragReorder } from '../hooks/drag_reorder';
import { toSlugParam } from '../utils/slug';
import { AlbumCard } from './albums';
import { ContextMenu } from '../components/context_menu';
import { ScanStatusBanner } from '../components/scan_status_banner';
import { TrendingTracks } from '../components/trending_tracks';
import { GeoTrendingTracks } from '../components/geo_trending_tracks';
import { TopTracksSection } from '../components/top_tracks';
import {
  moveHomeSection,
  type HomeSectionId
} from '../utils/home_sections';
import {
  FolderIcon,
  KeyIcon,
  LogoIcon,
  NoteIcon,
  PlayIcon,
  PlusIcon,
  RefreshIcon,
  ShuffleIcon
} from '../components/icons';
import type { TrackMeta } from '../types';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function pickRandom(tracks: TrackMeta[], excludeId?: string): TrackMeta | null {
  if (tracks.length === 0) return null;
  if (tracks.length === 1 || !excludeId) {
    return tracks[Math.floor(Math.random() * tracks.length)];
  }
  let pick: TrackMeta;
  do {
    pick = tracks[Math.floor(Math.random() * tracks.length)];
  } while (pick.id === excludeId);
  return pick;
}

function RandomSongCard({ track, onAnother }: { track: TrackMeta; onAnother(): void }) {
  const { playNow, enqueueEnd, remoteLocked } = usePlayer();
  const { buildMenu } = useTrackMenu();
  const art = useAlbumArt(albumKey(track), track);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      className="xe_home-song-card"
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="xe_home-song-card__art">
        {art ? <img src={art} alt="" loading="lazy" /> : <LogoIcon size={30} />}
      </div>
      <div className="xe_home-song-card__info">
        <span className="xe_home-song-card__title">{track.title}</span>
        <span className="xe_home-song-card__artist">{track.artist}</span>
      </div>
      <div className="xe_home-song-card__actions">
        <button type="button" className="xe_btn xe_btn--accent" onClick={() => playNow([track], 0)} disabled={remoteLocked}>
          <PlayIcon size={14} />
          Play
        </button>
        <button type="button" className="xe_btn" onClick={() => enqueueEnd([track])} disabled={remoteLocked}>
          <PlusIcon size={14} />
          Enqueue
        </button>
        <button type="button" className="xe_btn xe_btn--quiet" onClick={onAnother}>
          <RefreshIcon size={14} />
          Pick another
        </button>
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={buildMenu(track)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

function headerFromEvent(target: EventTarget | null, container: HTMLElement): Element | null {
  if (!(target instanceof Element)) return null;
  if (target.closest('button, a, input, select, textarea')) return null;
  const header = target.closest('.xe_home-section__header, .xe_home-section__title');
  return header && container.contains(header) ? header : null;
}

function HomeSectionSlot({
  sectionId,
  editing,
  dragging,
  style,
  didDragRef,
  onEdit,
  onStopEditing,
  onContextMenu,
  onPointerDown,
  children
}: {
  sectionId: HomeSectionId;
  editing: boolean;
  dragging: boolean;
  style: CSSProperties;
  didDragRef: { current: boolean };
  onEdit(): void;
  onStopEditing(): void;
  onContextMenu(event: MouseEvent<HTMLDivElement>): void;
  onPointerDown(event: PointerEvent<HTMLDivElement>): void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const stopOutside = (event: globalThis.MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onStopEditing();
    };
    document.addEventListener('mousedown', stopOutside);
    return () => document.removeEventListener('mousedown', stopOutside);
  }, [editing, onStopEditing]);

  return (
    <div
      ref={ref}
      className={`xe_home-section-slot${editing ? ' xe_home-section-slot--editing' : ''}${
        dragging ? ' xe_home-section-slot--dragging' : ''
      }`}
      data-home-section={sectionId}
      style={style}
      onPointerDownCapture={(event) => {
        if (editing && headerFromEvent(event.target, event.currentTarget)) onPointerDown(event);
      }}
      onPointerUpCapture={(event) => {
        if (
          editing &&
          !didDragRef.current &&
          headerFromEvent(event.target, event.currentTarget)
        ) {
          onStopEditing();
        }
      }}
      onClickCapture={(event) => {
        if (didDragRef.current) {
          didDragRef.current = false;
          return;
        }
        if (editing && headerFromEvent(event.target, event.currentTarget)) onStopEditing();
      }}
      onDoubleClickCapture={(event) => {
        if (!headerFromEvent(event.target, event.currentTarget)) return;
        event.preventDefault();
        onEdit();
      }}
      onContextMenuCapture={(event) => {
        if (!headerFromEvent(event.target, event.currentTarget)) return;
        event.preventDefault();
        event.stopPropagation();
        onContextMenu(event);
      }}
    >
      {children}
    </div>
  );
}

export function HomePage() {
  const { tracks, permissionNeeded, supported, addFolder, restoreAccess } = useLibrary();
  const { playNow, remoteLocked } = usePlayer();
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const needsSetup = !localStorage.getItem('hai');

  const [randomTrack, setRandomTrack] = useState<TrackMeta | null>(null);
  const [worldwideTrackIds, setWorldwideTrackIds] = useState<string[] | null>(null);
  const [editingSection, setEditingSection] = useState<HomeSectionId | null>(null);
  const [sectionMenu, setSectionMenu] = useState<{
    sectionId: HomeSectionId;
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    setRandomTrack(pickRandom(tracks));
  }, [tracks.length]);

  useEffect(() => {
    setWorldwideTrackIds(null);
  }, [settings.lastfmAmenities, settings.lastfmTrendingLimit]);

  const handleWorldwideMatches = useCallback((trackIds: string[] | null) => {
    setWorldwideTrackIds(trackIds);
  }, []);
  const stopEditing = useCallback(() => setEditingSection(null), []);

  const [albumSeed, setAlbumSeed] = useState(0);
  const albums = useMemo(() => groupAlbums(tracks), [tracks]);
  const randomAlbums = useMemo(
    () => intelligentShuffle(albums, (a) => ({ id: a.key, artist: a.artist })).slice(0, 9),
    [albums.length, albumSeed]
  );
  const visibleSections = useMemo(
    () =>
      settings.homeSections.filter((sectionId) => {
        if (sectionId === 'random-song') return Boolean(randomTrack);
        if (sectionId === 'trending-worldwide') return settings.lastfmAmenities;
        if (sectionId === 'trending-country') {
          return (
            settings.lastfmAmenities &&
            (settings.lastfmGeoAmenities || Boolean(settings.lastfmGeoCountry))
          );
        }
        if (sectionId === 'top-tracks-week' || sectionId === 'top-tracks-all-time') {
          return settings.lastfmAmenities;
        }
        return true;
      }),
    [
      randomTrack,
      settings.homeSections,
      settings.lastfmAmenities,
      settings.lastfmGeoAmenities,
      settings.lastfmGeoCountry
    ]
  );
  const {
    listRef: homeSectionsRef,
    dragging: homeSectionDragging,
    handleProps: homeSectionHandleProps,
    itemStyle: homeSectionItemStyle,
    didDragRef: homeSectionDidDragRef
  } = useDragReorder((from, to) => {
    const source = visibleSections[from];
    const target = visibleSections[to];
    if (!source || !target) return;
    update({
      homeSections: moveHomeSection(settings.homeSections, source, target, to > from)
    });
  });

  const shuffleAll = () => {
    const order = intelligentShuffle(tracks, (t) => ({ id: t.id, artist: t.artist }), getRecentIds());
    playNow(order, 0);
  };

  const removeSection = (sectionId: HomeSectionId) => {
    update({ homeSections: settings.homeSections.filter((id) => id !== sectionId) });
    if (editingSection === sectionId) setEditingSection(null);
    setSectionMenu(null);
  };

  const renderSection = (sectionId: HomeSectionId, index: number) => {
    let content: ReactNode = null;
    switch (sectionId) {
      case 'random-albums':
        content = (
          <section className="xe_home-section">
            <div className="xe_home-section__header">
              <h2 className="xe_home-section__title">Pick some random albums</h2>
              <button
                type="button"
                className="xe_btn xe_btn--quiet"
                onClick={() => setAlbumSeed((seed) => seed + 1)}
                disabled={albums.length <= 1}
              >
                <RefreshIcon size={14} />
                Reshuffle
              </button>
            </div>
            <div className="xe_home-carousel">
              {randomAlbums.map((album) => (
                <div className="xe_home-carousel__item" key={album.key}>
                  <AlbumCard
                    album={album}
                    onOpen={() =>
                      navigate(`/albums/by:${toSlugParam(album.artist)}/${toSlugParam(album.album)}`, {
                        state: { from: '/' }
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        );
        break;
      case 'random-song':
        if (randomTrack) {
          content = (
            <section className="xe_home-section">
              <h2 className="xe_home-section__title">Choose a random song</h2>
              <RandomSongCard
                track={randomTrack}
                onAnother={() => setRandomTrack((prev) => pickRandom(tracks, prev?.id))}
              />
            </section>
          );
        }
        break;
      case 'trending-worldwide':
        if (settings.lastfmAmenities) {
          content = (
            <TrendingTracks
              searchLimit={settings.lastfmTrendingLimit}
              displayLimit={settings.lastfmAmenitiesDisplayLimit}
              onMatchedTracks={handleWorldwideMatches}
            />
          );
        }
        break;
      case 'trending-country':
        if (
          settings.lastfmAmenities &&
          (settings.lastfmGeoAmenities || settings.lastfmGeoCountry)
        ) {
          const worldwideVisible = settings.homeSections.includes('trending-worldwide');
          content = (
            <GeoTrendingTracks
              selectedCountry={settings.lastfmGeoCountry}
              searchLimit={settings.lastfmTrendingLimit}
              displayLimit={settings.lastfmAmenitiesDisplayLimit}
              excludedTrackIds={
                settings.lastfmGeoHideWorldwideDuplicates && worldwideVisible
                  ? worldwideTrackIds
                  : []
              }
            />
          );
        }
        break;
      case 'top-tracks-week':
        if (settings.lastfmAmenities) {
          content = (
            <TopTracksSection
              title="Your top tracks this week"
              period="7day"
              displayLimit={settings.lastfmAmenitiesDisplayLimit}
            />
          );
        }
        break;
      case 'top-tracks-all-time':
        if (settings.lastfmAmenities) {
          content = (
            <TopTracksSection
              title="Your top tracks of all time"
              period="overall"
              displayLimit={settings.lastfmAmenitiesDisplayLimit}
            />
          );
        }
        break;
    }
    if (!content) return null;

    return (
      <HomeSectionSlot
        key={sectionId}
        sectionId={sectionId}
        editing={editingSection === sectionId}
        dragging={homeSectionDragging?.from === index}
        style={homeSectionItemStyle(index)}
        didDragRef={homeSectionDidDragRef}
        onEdit={() => setEditingSection(sectionId)}
        onStopEditing={stopEditing}
        onContextMenu={(event) =>
          setSectionMenu({ sectionId, x: event.clientX, y: event.clientY })
        }
        onPointerDown={homeSectionHandleProps(index).onPointerDown}
      >
        {content}
      </HomeSectionSlot>
    );
  };

  if (!supported) {
    return (
      <div className="xe_page">
        <h1 className="xe_page__title">Not Supported</h1>
        <p className="xe_empty-note">
          The browser you're using doesn't seem to support (or you have denied access to)
          the File System Access API, which is required for Xebrine to read your music files. Please
          try again using a different browser that supports it. In the meantime, <a href="https://voxity.dev" target="_blank">try Voxity</a> or <Link to="/radio">the radio</Link>?
        </p>
      </div>
    );
  }

  return (
    <div className="xe_page">
      <div className="xe_home-greeting">
        <h1 className="xe_page__title">{getGreeting()}</h1>
      </div>

      <ScanStatusBanner />

      {needsSetup && (
        <div className="xe_banner xe_home-setup-banner">
          <span>Welcome to Xebrine! Would you like to go through a setup flow?</span>
          <button
            type="button"
            className="xe_btn xe_btn--accent"
            onClick={() => navigate('/i/flow/setup')}
          >
            Start setup
          </button>
        </div>
      )}

      {permissionNeeded && (
        <div className="xe_banner">
          <span>Xebrine needs permission to read your music folders again. If you can, click "Allow on every visit"</span>
          <button type="button" className="xe_btn xe_btn--accent" onClick={() => void restoreAccess()}>
            <KeyIcon size={14} />
            Restore access
          </button>
        </div>
      )}

      <div className="xe_page__scroll">
        <div className="xe_home-ctas">
          <button
            type="button"
            className="xe_btn xe_btn--cta"
            onClick={shuffleAll}
            disabled={tracks.length === 0 || remoteLocked}
          >
            <ShuffleIcon size={16} />
            Shuffle all music
          </button>
          <button
            type="button"
            className="xe_btn xe_btn--cta"
            onClick={() => playNow(tracks, 0)}
            disabled={tracks.length === 0 || remoteLocked}
          >
            <PlayIcon size={16} />
            Play all music
          </button>
          <button type="button" className="xe_btn xe_btn--cta" onClick={() => void addFolder()}>
            <FolderIcon size={16} />
            Add folder
          </button>
          <button type="button" className="xe_btn xe_btn--cta" onClick={() => navigate('/library')}>
            <NoteIcon size={16} />
            Go to library
          </button>
        </div>

        {tracks.length === 0 ? (
          <p className="xe_empty-note">Your library is empty!</p>
        ) : (
          <div className="xe_home-sections" ref={homeSectionsRef}>
            {visibleSections.map(renderSection)}
          </div>
        )}
      </div>
      {sectionMenu && (
        <ContextMenu
          x={sectionMenu.x}
          y={sectionMenu.y}
          items={[
            {
              label: 'Enable editing for this section',
              onSelect: () => setEditingSection(sectionMenu.sectionId)
            },
            {
              label: 'Remove this section',
              onSelect: () => removeSection(sectionMenu.sectionId)
            }
          ]}
          onClose={() => setSectionMenu(null)}
        />
      )}
    </div>
  );
}
