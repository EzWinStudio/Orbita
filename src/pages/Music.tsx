import { useEffect, useRef, useState } from 'react';
import { Music4, Pause, Play, SkipBack, SkipForward, Trash2, Upload, Volume2 } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { useApp } from '../store';
import type { PlaylistTrack } from '../types';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Music() {
  const { data, actions, confirm } = useApp();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [importing, setImporting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const tracks = data?.playlist ?? [];
  const current = tracks.find((track) => track.id === currentId) ?? null;
  const volume = data?.settings.musicVolume ?? 0.75;

  useEffect(() => {
    if (!currentId && tracks.length > 0) setCurrentId(tracks[0].id);
  }, [tracks, currentId]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    element.volume = Math.min(1, Math.max(0, volume));
  }, [volume, currentId]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element || !current) return;
    if (playing) {
      if (element.ended) element.currentTime = 0;
      element.play().catch(() => setPlaying(false));
    } else {
      element.pause();
    }
  }, [playing, current]);

  function play(track: PlaylistTrack) {
    if (track.id === currentId) {
      setPlaying((value) => !value);
      return;
    }
    setCurrentId(track.id);
    setProgress(0);
    setDuration(0);
    setPlaying(true);
  }

  function step(direction: 1 | -1) {
    if (tracks.length === 0) return;
    const index = tracks.findIndex((track) => track.id === currentId);
    const next = (index + direction + tracks.length) % tracks.length;
    setCurrentId(tracks[next].id);
    setProgress(0);
    setDuration(0);
    setPlaying(true);
  }

  async function importTracks() {
    setImporting(true);
    await actions.importMusic();
    setImporting(false);
  }

  async function remove(track: PlaylistTrack) {
    const ok = await confirm({
      title: 'Parçayı sil',
      message: `“${track.title}” hem listeden hem diskten silinecek.`,
      confirmLabel: 'Sil',
    });
    if (!ok) return;
    if (track.id === currentId) {
      setPlaying(false);
      setCurrentId(null);
    }
    await actions.removeTrack(track.id);
  }

  return (
    <>
      <PageHeader
        eyebrow="Stüdyo"
        title="Müzik"
        subtitle="Kendi ses dosyalarını içe aktar. Dosyalar bu bilgisayarda, hesabına ait müzik klasöründe tutulur."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => void importTracks()} disabled={importing}>
            <Upload size={15} /> {importing ? 'Seçim bekleniyor…' : 'Müzik ekle'}
          </button>
        }
      />

      {tracks.length === 0 ? (
        <EmptyState
          icon={<Music4 size={22} />}
          title="Liste boş"
          description="MP3, M4A, WAV, OGG veya FLAC dosyalarını ekleyerek başla. Her hesabın listesi ayrıdır."
          action={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void importTracks()}>
              <Upload size={14} /> Dosya seç
            </button>
          }
        />
      ) : (
        <div className="card music-card">
          <div className="card-header">
            <h2>Çalma listesi</h2>
            <span className="music-count">{tracks.length} parça</span>
          </div>
          <ul className="music-list">
            {tracks.map((track, index) => {
              const isCurrent = track.id === currentId;
              return (
                <li key={track.id} className={`music-row${isCurrent ? ' playing' : ''}`}>
                  <button
                    type="button"
                    className="music-play"
                    onClick={() => play(track)}
                    aria-label={isCurrent && playing ? `${track.title} duraklat` : `${track.title} çal`}
                  >
                    {isCurrent && playing ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <span className="music-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="music-info">
                    <strong>{track.title}</strong>
                    <small>
                      {track.artist || 'Sanatçı yok'} · {formatSize(track.size)}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="btn btn-danger-ghost btn-sm"
                    onClick={() => void remove(track)}
                    aria-label={`${track.title} sil`}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {current ? (
        <div className="music-player">
          <div className="music-now">
            <span className="music-cover">
              <Music4 size={18} />
            </span>
            <span className="music-now-text">
              <strong>{current.title}</strong>
              <small>{current.artist || 'Sanatçı yok'}</small>
            </span>
          </div>

          <div className="music-center">
            <div className="music-controls">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => step(-1)} aria-label="Önceki parça">
                <SkipBack size={14} />
              </button>
              <button
                type="button"
                className="music-toggle"
                onClick={() => setPlaying((value) => !value)}
                aria-label={playing ? 'Duraklat' : 'Çal'}
              >
                {playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => step(1)} aria-label="Sonraki parça">
                <SkipForward size={14} />
              </button>
            </div>
            <div className="music-seek">
              <span>{formatTime(progress)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(progress, duration || 0)}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setProgress(value);
                  if (audioRef.current) audioRef.current.currentTime = value;
                }}
                aria-label="Parça konumu"
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="music-volume">
            <Volume2 size={15} />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => void actions.updateSettings({ musicVolume: Number(event.target.value) })}
              aria-label="Ses düzeyi"
            />
          </div>

          <audio
            ref={audioRef}
            src={current.src}
            preload="metadata"
            onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
            onEnded={() => {
              if (tracks.length > 1) step(1);
              else {
                setPlaying(false);
                setProgress(0);
              }
            }}
          />
        </div>
      ) : null}
    </>
  );
}
