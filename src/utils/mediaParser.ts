import { PlatformType, UniversalMediaItem, MediaFormat, TeraboxFile } from '../types';

/**
 * Detects the media platform from a given URL string.
 */
export function detectPlatform(inputUrl: string): PlatformType {
  if (!inputUrl) return 'aio';
  const url = inputUrl.trim().toLowerCase();

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'youtube';
  }
  if (url.includes('terabox.com') || url.includes('1024tera.com') || url.includes('teraboxapp.com') || url.includes('dubox.com')) {
    return 'terabox';
  }
  if (url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.com')) {
    return 'facebook';
  }
  if (url.includes('instagram.com') || url.includes('instagr.am')) {
    return 'instagram';
  }
  if (url.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (url.includes('pinterest.com') || url.includes('pin.it')) {
    return 'pinterest';
  }
  if (url.includes('xnxx.com')) {
    return 'xnxx';
  }
  if (url.includes('xvideos.com')) {
    return 'xvideos';
  }

  return 'aio';
}

/**
 * Formats raw byte counts into human-readable strings (e.g. 7.02 MB).
 */
export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes === 0) {
    return 'Unknown size';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0) return `${bytes} Bytes`;
  const sizeIdx = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, sizeIdx)).toFixed(2))} ${sizes[sizeIdx]}`;
}

/**
 * Formats a duration in seconds into MM:SS or HH:MM:SS.
 */
export function formatDuration(secondsOrStr?: number | string): string {
  if (!secondsOrStr) return '0:00';
  if (typeof secondsOrStr === 'string' && secondsOrStr.includes(':')) {
    return secondsOrStr;
  }
  const totalSecs = Math.floor(Number(secondsOrStr));
  if (isNaN(totalSecs) || totalSecs <= 0) return '0:00';

  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const paddedSecs = seconds < 10 ? `0${seconds}` : `${seconds}`;
  if (hours > 0) {
    const paddedMins = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${paddedMins}:${paddedSecs}`;
  }
  return `${minutes}:${paddedSecs}`;
}

/**
 * Safely normalizes responses from various Prexzy media endpoints into a unified UniversalMediaItem.
 */
export function normalizeMediaResponse(
  platform: PlatformType,
  rawData: any,
  originalUrl: string
): UniversalMediaItem {
  const fallbackId = `media_${Date.now()}`;

  // Default skeleton
  const result: UniversalMediaItem = {
    id: fallbackId,
    title: 'Extracted Media',
    platform,
    sourceUrl: originalUrl,
    mediaType: 'video',
    streams: [],
    downloads: [],
    raw: rawData,
  };

  if (!rawData) {
    return result;
  }

  // 1. TERABOX Platform
  if (platform === 'terabox' || rawData.data?.files || rawData.data?.rootPath) {
    const tData = rawData.data || rawData;
    const rawFiles: any[] = Array.isArray(tData.files) ? tData.files : [];
    const files: TeraboxFile[] = rawFiles.map((f: any, idx: number) => ({
      fsId: f.fsId || f.fs_id || idx,
      filename: f.filename || f.server_filename || `File_${idx + 1}`,
      path: f.path || '',
      sizeBytes: f.sizeBytes || f.size || 0,
      sizeFormatted: f.sizeFormatted || formatBytes(f.sizeBytes || f.size),
      category: f.category || (f.filename?.endsWith('.mp4') ? 'video' : 'photo'),
      thumbnail: f.thumbnail || f.thumbs?.url3 || '',
      streamUrl: f.streamUrl || f.dlink || '',
      md5: f.md5 || '',
    }));

    const firstVideo = files.find(f => f.category === 'video' || f.filename?.endsWith('.mp4'));
    const firstPlayable = firstVideo || files[0];

    result.title = tData.rootPath?.replace(/^\//, '') || files[0]?.filename || 'Terabox Cloud Media';
    result.thumbnail = firstPlayable?.thumbnail || '';
    result.mediaType = files.length > 1 ? 'folder' : (firstVideo ? 'video' : 'image');
    result.streamUrl = firstPlayable?.streamUrl || '';
    result.teraboxData = {
      shareId: tData.shareId || '',
      rootPath: tData.rootPath || '',
      totals: tData.totals || { items: files.length, folders: 0, videos: files.filter(f => f.category === 'video').length, photos: files.filter(f => f.category === 'photo').length },
      files,
    };

    // Create stream & download options for files
    files.forEach((f, idx) => {
      if (f.streamUrl) {
        result.streams.push({
          id: `tb_stream_${idx}`,
          label: `${f.filename} (${f.sizeFormatted})`,
          quality: f.category === 'video' ? 'Cloud Video Stream' : 'Image View',
          extension: f.filename.split('.').pop() || 'mp4',
          fileSizeBytes: f.sizeBytes,
          fileSizeFormatted: f.sizeFormatted,
          url: f.streamUrl,
          directStreamable: true,
        });
        result.downloads.push({
          id: `tb_dl_${idx}`,
          label: `${f.filename}`,
          quality: f.sizeFormatted,
          extension: f.filename.split('.').pop() || 'mp4',
          fileSizeBytes: f.sizeBytes,
          fileSizeFormatted: f.sizeFormatted,
          url: f.streamUrl,
          directStreamable: true,
        });
      }
    });

    return result;
  }

  // 2. FACEBOOK Platform
  if (platform === 'facebook' || rawData.data?.download_links) {
    const fbData = rawData.data || rawData;
    result.title = fbData.title || 'Facebook Video';
    result.thumbnail = fbData.thumbnail || '';
    result.duration = fbData.duration || '';
    result.mediaType = 'video';

    const links: any[] = Array.isArray(fbData.download_links) ? fbData.download_links : [];
    links.forEach((link: any, idx: number) => {
      const q = link.quality || (idx === 0 ? '720p (HD)' : '360p (SD)');
      const fmt: MediaFormat = {
        id: `fb_${idx}`,
        label: `MP4 - ${q}`,
        quality: q,
        extension: link.format || 'mp4',
        url: link.url,
        directStreamable: true,
      };
      result.downloads.push(fmt);
      result.streams.push(fmt);
    });

    if (result.streams.length > 0) {
      result.streamUrl = result.streams[0].url;
    }

    return result;
  }

  // 3. YOUTUBE Platform (from ytmp4 / ytmp3 / ytinfo)
  if (platform === 'youtube' || rawData.type === 'video' || rawData.type === 'audio' || rawData.info) {
    const info = rawData.info || rawData;
    result.id = info.id || fallbackId;
    result.title = info.title || 'YouTube Media';
    result.thumbnail = info.thumbnail || (info.id ? `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg` : '');
    result.author = info.channel || info.uploader || '';
    result.channelUrl = info.channel_url || '';
    result.duration = info.duration_string || formatDuration(info.duration);
    result.durationSeconds = typeof info.duration === 'number' ? info.duration : undefined;
    result.views = info.view_count || undefined;
    result.likes = info.like_count || undefined;
    result.uploadDate = info.upload_date || undefined;

    const isAudioType = rawData.type === 'audio' || rawData.ext === 'mp3' || rawData.abr;
    result.mediaType = isAudioType ? 'audio' : 'video';

    // Primary download_url
    if (rawData.download_url) {
      const primaryQuality = rawData.quality || (isAudioType ? 'High Quality Audio' : 'Best Quality Video');
      const primaryExt = rawData.ext || (isAudioType ? 'mp3' : 'mp4');
      const primaryFmt: MediaFormat = {
        id: 'yt_primary',
        label: `${primaryQuality} (${primaryExt.toUpperCase()})`,
        quality: primaryQuality,
        extension: primaryExt,
        fileSizeBytes: rawData.filesize,
        fileSizeFormatted: formatBytes(rawData.filesize),
        url: rawData.download_url,
        directStreamable: true,
      };
      result.streams.push(primaryFmt);
      result.downloads.push(primaryFmt);
      result.streamUrl = rawData.download_url;
    }

    // Available Qualities Array
    if (Array.isArray(rawData.qualities)) {
      rawData.qualities.forEach((qItem: any, idx: number) => {
        const qLabel = qItem.quality || qItem.resolution || `Format ${qItem.format_id || idx + 1}`;
        const fmtExt = qItem.ext || 'mp4';
        const itemFmt: MediaFormat = {
          id: `yt_q_${qItem.format_id || idx}`,
          label: `${qLabel} (${fmtExt.toUpperCase()})`,
          quality: qLabel,
          resolution: qItem.resolution,
          extension: fmtExt,
          fileSizeBytes: qItem.filesize,
          fileSizeFormatted: formatBytes(qItem.filesize),
          url: qItem.download_url || qItem.url,
          directStreamable: true,
          fps: qItem.fps,
          formatNote: qItem.format,
        };
        // Avoid duplicate primary
        if (!result.downloads.some(d => d.url === itemFmt.url)) {
          result.downloads.push(itemFmt);
          result.streams.push(itemFmt);
        }
      });
    }

    // If companion audio was bundled
    if (rawData.audio_download_url) {
      result.downloads.push({
        id: 'yt_audio_bundled',
        label: 'Audio Only (MP3)',
        quality: '320kbps MP3',
        extension: 'mp3',
        url: rawData.audio_download_url,
        directStreamable: true,
      });
    }

    return result;
  }

  // 4. PINTEREST Platform
  if (platform === 'pinterest' || Array.isArray(rawData.data)) {
    const pData = rawData.data || rawData;
    if (Array.isArray(pData)) {
      result.title = 'Pinterest Image Collection';
      result.mediaType = 'gallery';
      result.galleryImages = pData.filter(item => typeof item === 'string');
      result.thumbnail = result.galleryImages[0] || '';
      result.galleryImages.forEach((imgUrl, idx) => {
        result.downloads.push({
          id: `pin_${idx}`,
          label: `Image ${idx + 1} (Full Res)`,
          quality: 'Original Resolution',
          extension: 'jpg',
          url: imgUrl,
          directStreamable: false,
        });
      });
      return result;
    }

    result.title = pData.title || 'Pinterest Media';
    result.thumbnail = pData.image || pData.thumbnail || '';
    const pinUrl = pData.url || pData.download_url || pData.video || pData.image;
    if (pinUrl) {
      const isVideo = pinUrl.includes('.mp4') || pData.video;
      result.mediaType = isVideo ? 'video' : 'image';
      result.streamUrl = pinUrl;
      result.downloads.push({
        id: 'pin_dl',
        label: isVideo ? 'Video (MP4)' : 'Original Image (HD)',
        quality: 'High Resolution',
        extension: isVideo ? 'mp4' : 'jpg',
        url: pinUrl,
        directStreamable: isVideo,
      });
    }
    return result;
  }

  // 5. XNXX & XVIDEOS Platforms
  if (platform === 'xnxx' || platform === 'xvideos' || rawData.best || rawData.hls) {
    result.title = rawData.title || (platform === 'xnxx' ? 'XNXX Video' : 'Xvideos Video');
    
    // Resolve real thumbnail (Xvideos often returns empty thumb: "", or lightbox-blank.gif)
    let resolvedThumb = rawData.image || rawData.thumb || '';
    if (!resolvedThumb || resolvedThumb.includes('blank.gif') || resolvedThumb.length < 10) {
      // Find UUID in best.url, hls, or qualities
      const sampleUrl = rawData.best?.url || rawData.hls || (Array.isArray(rawData.qualities) && rawData.qualities[0]?.url) || '';
      const uuidMatch = sampleUrl.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (uuidMatch) {
        const uuid = uuidMatch[1];
        if (platform === 'xvideos' || sampleUrl.includes('xvideos')) {
          resolvedThumb = `https://thumbs-gcore.xvideos-cdn.com/${uuid}/0/xv_4_t.jpg`;
        } else {
          resolvedThumb = `https://thumbs-gcore.xnxx-cdn.com/${uuid}/0/xn_4_t.jpg`;
        }
      }
    }

    result.thumbnail = resolvedThumb;
    result.duration = formatDuration(rawData.duration);
    result.author = rawData.uploader?.name || (typeof rawData.uploader === 'string' ? rawData.uploader : 'Creator');
    result.mediaType = 'video';

    // If qualities array provided
    if (Array.isArray(rawData.qualities)) {
      rawData.qualities.forEach((qItem: any, idx: number) => {
        const qLabel = qItem.quality || `Quality ${idx + 1}`;
        const fmt: MediaFormat = {
          id: `${platform}_q_${idx}`,
          label: `MP4 - ${qLabel}`,
          quality: qLabel,
          extension: 'mp4',
          url: qItem.url,
          directStreamable: true,
        };
        result.downloads.push(fmt);
        result.streams.push(fmt);
      });
    } else if (rawData.best?.url) {
      const bestFmt: MediaFormat = {
        id: `${platform}_best`,
        label: `MP4 - ${rawData.best.quality || 'Best Quality'}`,
        quality: rawData.best.quality || '360p',
        extension: 'mp4',
        url: rawData.best.url,
        directStreamable: true,
      };
      result.downloads.push(bestFmt);
      result.streams.push(bestFmt);
    }

    // Add HLS stream if available
    if (rawData.hls) {
      const hlsFmt: MediaFormat = {
        id: `${platform}_hls`,
        label: 'Adaptive HLS Stream (Auto Quality)',
        quality: 'HLS Auto',
        extension: 'm3u8',
        url: rawData.hls,
        directStreamable: true,
      };
      result.streams.unshift(hlsFmt);
      result.downloads.push(hlsFmt);
    }

    // Set primary streamUrl (prefer MP4 direct or HLS)
    result.streamUrl = result.streams.find(s => s.extension === 'mp4')?.url || rawData.hls || result.streams[0]?.url || '';

    return result;
  }

  // 6. TIKTOK & INSTAGRAM & AIO Generic handling
  const rootData = rawData.data || rawData;
  result.title = rootData.title || rootData.caption || rootData.desc || `${platform.toUpperCase()} Media`;
  result.thumbnail = rootData.thumbnail || rootData.cover || rootData.avatar || '';
  result.author = rootData.author?.nickname || rootData.author?.unique_id || rootData.owner || '';
  result.duration = rootData.duration ? formatDuration(rootData.duration) : '';

  // Extract possible video or download URLs
  const candidateUrls: { url: string; label: string; quality?: string }[] = [];

  if (rootData.play || rootData.video_url || rootData.download_url || rootData.url) {
    candidateUrls.push({
      url: rootData.play || rootData.video_url || rootData.download_url || rootData.url,
      label: 'HD Video (No Watermark)',
      quality: 'HD 1080p',
    });
  }

  if (rootData.music || rootData.audio_url || rootData.sound) {
    candidateUrls.push({
      url: rootData.music || rootData.audio_url || rootData.sound,
      label: 'Audio Track',
      quality: 'Original Audio (MP3)',
    });
  }

  if (Array.isArray(rootData.urls)) {
    rootData.urls.forEach((u: any, idx: number) => {
      candidateUrls.push({
        url: typeof u === 'string' ? u : u.url,
        label: `Media Stream ${idx + 1}`,
      });
    });
  }

  candidateUrls.forEach((cand, idx) => {
    const ext = cand.url.includes('.mp3') ? 'mp3' : (cand.url.includes('.jpg') || cand.url.includes('.png') ? 'jpg' : 'mp4');
    const fmt: MediaFormat = {
      id: `gen_${idx}`,
      label: cand.label,
      quality: cand.quality || 'Default Quality',
      extension: ext,
      url: cand.url,
      directStreamable: ext === 'mp4' || ext === 'mp3',
    };
    result.downloads.push(fmt);
    if (fmt.directStreamable) {
      result.streams.push(fmt);
    }
  });

  if (result.streams.length > 0) {
    result.streamUrl = result.streams[0].url;
  }

  return result;
}
