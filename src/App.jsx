import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Menu, MapPin, Image as ImageIcon, List, Search, RotateCcw,
  X, Save, Check, RefreshCw, AlertTriangle, Navigation,
  Camera, Crosshair, PenTool, CheckCircle2, Info, Grid,
  Globe, Map, CheckSquare, MessageSquare, LayoutGrid, Map as MapIcon,
  User, ShieldCheck, Send, Download, Filter, BarChart3, Target
} from 'lucide-react';

// --- KONFIGURASI ---
const SHEET_DATA_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVeOlJvLHMUJY8PgM8ARmIvjDd7hv5yvYyaJAdct49Y1G_T3LDrLboqqXPj-HUjlZoKHkp-AfbYpXR/pub?output=csv";
const GOOGLE_SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxWQRFEe4ZQ1zFiPX6ZKVW_PEDQsqgU0WCkAMkfkyV_7SNM47BopcbV-15zykAFVZsO/exec";

// --- HELPER: PARSE CSV ---
const parseCSV = (text) => {
  try {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const matches = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
      const values = matches ? matches.map(v => v.trim().replace(/^"|"$/g, '')) : line.split(',');
      const obj = {};
      headers.forEach((header, i) => { obj[header] = values[i] || ''; });
      return obj;
    });
  } catch {
    return [];
  }
};

// --- HELPER: KONVERSI LINK GOOGLE DRIVE KE DIRECT IMAGE (THUMBNAIL) ---
const getDirectImageUrl = (url) => {
  if (!url) return null;
  if (url.includes('drive.google.com/file/d/')) {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
    }
  }
  return url;
};

// --- HELPER: HITUNG JARAK (HAVERSINE) ---
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2 || isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return null;
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
};

// --- HELPER: CEK WARING JARAK (> 50m atau Tidak Tersedia = Merah) ---
const checkDistanceWarning = (distanceStr) => {
  if (!distanceStr || distanceStr === '-' || distanceStr === 'N/A' || String(distanceStr).toLowerCase().includes('tidak')) {
    return true; // Merah untuk tidak tersedia
  }
  const str = String(distanceStr).toLowerCase();
  if (str.includes('km')) {
    return true; // Merah untuk hitungan KM (pasti > 1000m)
  }
  const val = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (!isNaN(val) && val > 50) {
    return true; // Merah jika > 50 meter
  }
  return false; // Hijau jika <= 50 meter
};

// --- HELPER: FORMAT WAKTU (Agar jam tidak pakai format ISO) ---
const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr; // Jika format gagal diparse, kembalikan teks aslinya
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).replace(/\./g, ':'); // Pastikan jam pakai titik dua (:)
};

// --- KOMPONEN TANDA TANGAN ---
const SignaturePad = ({ onSave }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2563eb';
    const rect = canvas.getBoundingClientRect();
    const clientX = (e.clientX || (e.touches && e.touches[0].clientX));
    const clientY = (e.clientY || (e.touches && e.touches[0].clientY));
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = (e.clientX || (e.touches && e.touches[0].clientX));
    const clientY = (e.clientY || (e.touches && e.touches[0].clientY));
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      onSave(null);
    }
  };

  return (
    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-1 bg-white">
      <canvas
        ref={canvasRef} width={400} height={150}
        className="w-full h-40 touch-none cursor-crosshair"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={() => { setIsDrawing(false); onSave(canvasRef.current?.toDataURL()); }}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={() => { setIsDrawing(false); onSave(canvasRef.current?.toDataURL()); }}
      />
      <div className="flex justify-between items-center p-2 bg-slate-50 rounded-b-xl border-t border-slate-100">
        <button type="button" onClick={clearCanvas} className="text-[10px] font-black text-red-500 uppercase tracking-widest px-2">Hapus</button>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Digital Signature</span>
      </div>
    </div>
  );
};

// --- KOMPONEN MAP INTERAKTIF (SINGLE PIN - FORM) ---
const LeafletMap = ({ lat, lng, onPosChange }) => {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const markerInstance = useRef(null);

  useEffect(() => {
    if (!window.L || !lat || !lng) return;

    if (!mapInstance.current) {
      mapInstance.current = window.L.map(mapContainer.current, {
        zoomControl: false,
        dragging: !window.L.Browser.mobile,
        touchZoom: true
      }).setView([lat, lng], 16);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OSM'
      }).addTo(mapInstance.current);

      markerInstance.current = window.L.marker([lat, lng], { draggable: true }).addTo(mapInstance.current);

      markerInstance.current.on('dragend', () => {
        const pos = markerInstance.current.getLatLng();
        onPosChange(pos.lat, pos.lng);
      });
    } else {
      mapInstance.current.setView([lat, lng], 16);
      markerInstance.current.setLatLng([lat, lng]);
    }
  }, [lat, lng, onPosChange]);

  return <div ref={mapContainer} className="w-full h-48 rounded-2xl border border-slate-200 overflow-hidden shadow-inner bg-slate-100 z-0" />;
};

// --- KOMPONEN MAP GLOBAL (SEMUA TOKO + CURRENT LOCATION) ---
const GlobalMap = ({ stores, onMarkerClick }) => {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);
  const currentLocMarkerRef = useRef(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!window.L) return;

    if (!mapInstance.current) {
      mapInstance.current = window.L.map(mapContainer.current).setView([-6.2, 106.8], 10);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstance.current);

      markersLayer.current = window.L.layerGroup().addTo(mapInstance.current);
    }

    markersLayer.current.clearLayers();
    const bounds = [];

    stores.forEach(store => {
      const lat = parseFloat(store.latitude);
      const lng = parseFloat(store.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        const iconHtml = `
          <div style="background-color: ${store.isDone ? '#10b981' : '#3b82f6'}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
        `;

        const customIcon = window.L.divIcon({
          html: iconHtml,
          className: 'custom-leaflet-marker',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        const marker = window.L.marker([lat, lng], { icon: customIcon });

        marker.on('click', () => {
          if (onMarkerClick) onMarkerClick(store);
        });

        markersLayer.current.addLayer(marker);
        bounds.push([lat, lng]);
      }
    });

    if (bounds.length > 0) {
      mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
    }

    setTimeout(() => { mapInstance.current.invalidateSize(); }, 100);
  }, [stores, onMarkerClick]);

  const locateUser = () => {
    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung Geolocation.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        if (currentLocMarkerRef.current) {
          mapInstance.current.removeLayer(currentLocMarkerRef.current);
        }

        const userIcon = window.L.divIcon({
          html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.8); animation: pulse 2s infinite;"></div>`,
          className: 'custom-user-marker',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        currentLocMarkerRef.current = window.L.marker([latitude, longitude], { icon: userIcon }).addTo(mapInstance.current);
        currentLocMarkerRef.current.bindPopup("<div class='font-bold text-xs p-1'>Lokasi Anda Saat Ini</div>").openPopup();

        mapInstance.current.flyTo([latitude, longitude], 15, { duration: 1.5 });
        setLocating(false);
      },
      () => {
        alert("Gagal melacak lokasi. Pastikan GPS HP Anda menyala dan diizinkan di browser.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full z-0" />
      <button
        onClick={locateUser}
        className="absolute bottom-6 right-6 z-[1000] bg-white p-3.5 rounded-full shadow-lg border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center group"
        title="Temukan Lokasi Saya"
      >
        <Crosshair size={22} className={`${locating ? 'animate-spin text-blue-500' : 'group-hover:text-blue-600'}`} />
      </button>

      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
          70% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
      `}</style>
    </div>
  );
};

// --- KOMPONEN KARTU TOKO ---
const StoreCard = ({ store, onClick }) => {
  const lat = parseFloat(store.latitude);
  const lng = parseFloat(store.longitude);

  const distanceStr = store['Jarak Validasi'] || store.distanceValidation || 'Tidak tersedia';
  const isDistanceFar = checkDistanceWarning(distanceStr);

  return (
    <div
      onClick={() => onClick(store)}
      className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-200 overflow-hidden cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all flex flex-col h-full group relative"
    >
      <div className="p-4 flex items-center gap-3 bg-white relative overflow-hidden">
        {/* REVISI LABEL: Tampilkan ONC dan Jarak (merah jika > 50m atau Tidak Tersedia) */}
        {store.isDone ? (
          <div className="absolute top-0 right-0 bg-slate-50 border-b border-l border-slate-200 px-2.5 py-1 rounded-bl-xl z-10 flex flex-col items-end shadow-sm">
            <span className={`text-[9px] font-black uppercase tracking-wider ${store.onc === 'Yes' ? 'text-purple-600' : 'text-rose-600'}`}>
              ONC: {store.onc || 'No'}
            </span>
            <span className={`text-[7.5px] font-bold tracking-wide mt-0.5 ${isDistanceFar ? 'text-rose-500' : 'text-emerald-500'}`}>
              Jarak: {distanceStr}
            </span>
          </div>
        ) : (
          <div className="absolute top-0 right-0 bg-purple-500 text-white text-[8px] font-black px-2 py-1 rounded-bl-lg uppercase tracking-widest z-10 shadow-sm">
            ONC Target
          </div>
        )}

        <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center shrink-0 border border-cyan-200 mt-2">
          <Globe size={20} className="text-cyan-600" />
        </div>
        <div className="flex-1 min-w-0 mt-2">
          <h3 className="font-extrabold text-[13px] text-slate-800 truncate uppercase tracking-tight">
            {store.name || 'TANPA NAMA'}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <CheckCircle2 size={12} className={store.isDone ? "text-emerald-500 fill-emerald-50" : "text-rose-500 fill-rose-50"} />
            <span className={`text-[10px] font-bold tracking-tight ${store.isDone ? 'text-emerald-500' : 'text-rose-500'}`}>
              {store.isDone ? 'Sudah Tersurvei' : 'Belum Tersurvei'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[160px] bg-slate-100 relative group-hover:opacity-90 transition-opacity overflow-hidden flex flex-col">
        {!isNaN(lat) && !isNaN(lng) ? (
          <iframe
            title={`map-${store.id}`}
            className="w-full h-full pointer-events-none absolute inset-0"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.003}%2C${lat - 0.003}%2C${lng + 0.003}%2C${lat + 0.003}&layer=mapnik&marker=${lat}%2C${lng}`}
          ></iframe>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 z-10 relative bg-slate-100">
            <MapPin size={32} />
            <span className="text-[8px] font-bold uppercase mt-1">Koordinat Salah</span>
          </div>
        )}

        {/* Timestamp Info Overlay - Ditampilkan jika sudah selesai agar terlihat urutannya */}
        {store.isDone && store.timestamp && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-6 z-10">
            <p className="text-[9px] font-medium text-white/90 truncate flex items-center gap-1">
              <CheckCircle2 size={10} className="text-emerald-400" />
              {store.timestamp}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [activeMenu, setActiveMenu] = useState('list');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(window.innerWidth >= 640);

  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedMapStore, setSelectedMapStore] = useState(null);
  const [selectedSuccessStore, setSelectedSuccessStore] = useState(null);
  const [selectedGalleryStore, setSelectedGalleryStore] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  const [formData, setFormData] = useState({
    surveyorName: '',
    updatedStoreName: '',
    visitStatus: 'Sudah Tersurvei',
    visitNotes: '',
    onc: 'No',
    oncReason: '',
    photo: null,
    gps: { lat: null, lng: null },
    signature: null,
    gpsLoading: false
  });

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(script);
    };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Ambil Data Master Mentah dari CSV
      const csvResponse = await fetch(`${SHEET_DATA_CSV_URL}&t=${Date.now()}`);
      const csvText = await csvResponse.text();
      const masterData = parseCSV(csvText);

      // 2. Ambil RIWAYAT SURVEI (Foto & Status) dari Google Apps Script (doGet)
      let historyData = [];
      try {
        const historyResponse = await fetch(GOOGLE_SHEETS_WEBAPP_URL);
        historyData = await historyResponse.json();
      } catch (err) {
        console.warn("Belum ada riwayat survei atau gagal fetch history", err);
      }

      // 3. Gabungkan Data (Merge)
      const mappedStores = masterData.map((item, index) => {
        const storeName = item['Nama Toko'] || item['name'] || '';

        // Cari apakah toko ini ada di history survei (menggunakan reverse agar ambil update TERBARU)
        const historyRecord = [...historyData].reverse().find(h =>
          h['Nama Toko (Sistem)'] === storeName ||
          h['Nama Toko'] === storeName
        );

        let isDone = false;
        let photo = '';
        let timestamp = '';
        let surveyor = '-';
        let rawPhotoUrl = '';
        let oncStatus = 'No';

        if (historyRecord) {
          const rawPhoto = historyRecord['Link Foto'] || historyRecord['Foto Toko'] || '';
          rawPhotoUrl = rawPhoto;
          photo = getDirectImageUrl(rawPhoto);
          isDone = true;
          timestamp = historyRecord['Timestamp'] || historyRecord['Tgl Survei'] || '';
          surveyor = historyRecord['Nama Surveyor'] || historyRecord['Surveyor'] || '-';
          oncStatus = historyRecord['ONC?'] || historyRecord['ONC'] || 'No';
        } else {
          const rawPhoto = item['Foto Toko'] || item['Link Foto'] || '';
          rawPhotoUrl = rawPhoto;
          photo = getDirectImageUrl(rawPhoto);
          timestamp = item['Tgl Survei'] || item['Timestamp'] || '';
          surveyor = item['Surveyor'] || item['Nama Surveyor'] || '-';
          isDone = Boolean(photo || timestamp);
        }

        return {
          ...item,
          ...historyRecord,
          id: index,
          name: storeName,
          Region: item['Region'] || item['region'] || '',
          latitude: item['Lat'] || item['latitude'] || item['Latitude'] || '',
          longitude: item['Long'] || item['longitude'] || item['Longitude'] || '',
          address: item['Alamat'] || item['address'] || '',
          isDone: isDone,
          photo: photo,
          rawPhotoUrl: rawPhotoUrl,
          timestamp: timestamp,
          surveyor: surveyor,
          onc: oncStatus
        };
      });

      setStores(mappedStores);
    } catch (err) {
      console.error("Gagal sinkronisasi.", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getLocation = useCallback(() => {
    setFormData(prev => ({ ...prev, gpsLoading: true }));
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError("Browser tidak mendukung GPS.");
      setFormData(prev => ({ ...prev, gpsLoading: false }));
      return;
    }

    const handleSuccess = (p) => {
      setFormData(prev => ({
        ...prev,
        gps: { lat: p.coords.latitude, lng: p.coords.longitude },
        gpsLoading: false
      }));
      setGpsError(null);
    };

    const handleError = (err) => {
      setFormData(prev => ({ ...prev, gpsLoading: false }));
      let msg = "Gagal mengambil GPS.";
      if (err.code === 1) msg = "Izin ditolak. Buka di Chrome/Safari & izinkan lokasi.";
      else if (err.code === 2) msg = "Sinyal GPS tidak tersedia.";
      else if (err.code === 3) msg = "Waktu pencarian GPS habis.";
      setGpsError(msg);
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    if (isFormOpen) {
      setFormData(prev => ({
        ...prev,
        gps: { lat: null, lng: null },
        updatedStoreName: selectedStore?.name || ''
      }));
      setGpsError(null);
      setTimeout(() => getLocation(), 800);
    }
  }, [isFormOpen, selectedStore, getLocation]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.surveyorName || !formData.photo) return;

    setIsSubmitting(true);
    const distance = calculateDistance(formData.gps.lat, formData.gps.lng, parseFloat(selectedStore?.latitude), parseFloat(selectedStore?.longitude));
    const payload = {
      timestamp: new Date().toLocaleString(),
      storeName: selectedStore?.name || '',
      updatedStoreName: formData.updatedStoreName,
      region: selectedStore?.Region || '',
      address: selectedStore?.address || '',
      surveyor: formData.surveyorName,
      status: formData.visitStatus,
      notes: formData.visitNotes,
      onc: formData.onc,
      oncReason: formData.oncReason,
      latitude: formData.gps.lat || 'Test_No_GPS',
      longitude: formData.gps.lng || 'Test_No_GPS',
      distanceValidation: distance !== null ? `${distance} meter` : 'Tidak tersedia',
      photo: formData.photo,
      signature: formData.signature
    };

    try {
      await fetch(GOOGLE_SHEETS_WEBAPP_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });

      setStores(prev => prev.map(s => s.id === selectedStore.id ? {
        ...s,
        isDone: true,
        photo: formData.photo,
        surveyor: formData.surveyorName,
        timestamp: payload.timestamp,
        onc: formData.onc,
        distanceValidation: payload.distanceValidation
      } : s));

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsFormOpen(false);
        setFormData({ surveyorName: '', updatedStoreName: '', visitStatus: 'Sudah Tersurvei', visitNotes: '', onc: 'No', oncReason: '', photo: null, gps: { lat: null, lng: null }, signature: null, gpsLoading: false });
      }, 2000);
    } catch {
      alert("Error pengiriman data.");
    } finally { setIsSubmitting(false); }
  };

  const openInGoogleMaps = (lat, lng) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  // FUNGSI SORTING TIMESTAMP
  const parseDateForSort = (dateStr) => {
    if (!dateStr) return 0;
    let time = new Date(dateStr).getTime();
    if (!isNaN(time)) return time;
    const match = String(dateStr).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})[^\d]+(\d{1,2})[\:\.](\d{1,2})[\:\.]?(\d{1,2})?/);
    if (match) {
      const year = match[3].length === 2 ? `20${match[3]}` : match[3];
      const month = match[2].padStart(2, '0');
      const day = match[1].padStart(2, '0');
      const hour = match[4].padStart(2, '0');
      const min = match[5].padStart(2, '0');
      const sec = match[6] ? match[6].padStart(2, '0') : '00';
      time = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`).getTime();
      if (!isNaN(time)) return time;
    }
    return 0;
  };

  // LOGIKA PENYARINGAN (FILTER)
  let filteredStores = stores.filter(s => {
    const searchMatch = !searchQuery || Object.values(s).some(value =>
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    );
    const statusMatch = statusFilter === 'all' ? true : (statusFilter === 'done' ? s.isDone : !s.isDone);

    return searchMatch && statusMatch;
  });

  // LOGIKA PENGURUTAN: Jika Filter "SELESAI" aktif, urutkan data dari yang terbaru disurvei
  if (statusFilter === 'done') {
    filteredStores.sort((a, b) => parseDateForSort(b.timestamp) - parseDateForSort(a.timestamp));
  }

  const groupedData = filteredStores.reduce((acc, s) => { const k = s.Region || 'LAINNYA'; if (!acc[k]) acc[k] = []; acc[k].push(s); return acc; }, {});

  const galleryStores = stores.filter(s => s.isDone && s.photo).sort((a, b) => parseDateForSort(b.timestamp) - parseDateForSort(a.timestamp));
  const successStores = stores.filter(s => s.isDone).sort((a, b) => parseDateForSort(b.timestamp) - parseDateForSort(a.timestamp));
  const isFormValid = formData.surveyorName.trim().length > 1 && formData.photo !== null;

  const handleExportCSV = () => {
    if (successStores.length === 0) return alert("Belum ada data untuk diekspor!");
    const headers = ["Nama Toko", "Region", "Surveyor", "Waktu Validasi", "Status", "Jarak Validasi", "ONC?", "Catatan", "Link Foto Asli"];
    const csvContent = [
      headers.join(","),
      ...successStores.map(store => {
        return [
          `"${store.name || ''}"`,
          `"${store.Region || ''}"`,
          `"${store.surveyor || ''}"`,
          `"${store.timestamp || ''}"`,
          `"${store['Status Visit'] || store.status || 'Sudah Tersurvei'}"`,
          `"${store['Jarak Validasi'] || store.distanceValidation || '-'}"`,
          `"${store['ONC?'] || store.onc || '-'}"`,
          `"${(store['Catatan'] || store.notes || '').replace(/"/g, '""')}"`,
          `"${store.rawPhotoUrl || ''}"`
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Data_Toko_Sukses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const menuItems = [
    { id: 'list', label: 'List Validasi', icon: List },
    { id: 'map', label: 'Map of Location', icon: MapPin },
    { id: 'gallery', label: 'Data gallery', icon: ImageIcon },
    { id: 'success', label: 'List Toko Sukses', icon: CheckSquare },
    { id: 'about', label: 'About', icon: Info },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'apps', label: 'App Gallery', icon: LayoutGrid },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">

      {/* OVERLAY MOBILE */}
      {isSidebarExpanded && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 sm:hidden transition-opacity"
          onClick={() => setIsSidebarExpanded(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed sm:relative top-0 left-0 h-full z-50 flex-shrink-0 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 overflow-y-auto ${isSidebarExpanded ? 'w-64 translate-x-0' : 'w-[72px] -translate-x-full sm:translate-x-0'}`}>
        <div className="p-3 flex flex-col gap-2 mt-2">
          {menuItems.map(menu => (
            <button
              key={menu.id}
              onClick={() => {
                setActiveMenu(menu.id);
                setSelectedMapStore(null);
                if (window.innerWidth < 640) setIsSidebarExpanded(false);
              }}
              className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap overflow-hidden ${activeMenu === menu.id
                ? 'bg-blue-50 text-blue-600 border border-blue-100 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                } ${!isSidebarExpanded && 'justify-center'}`}
              title={!isSidebarExpanded ? menu.label : ''}
            >
              <menu.icon size={20} className={`shrink-0 ${activeMenu === menu.id ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className={`transition-opacity duration-200 ${isSidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
                {menu.label}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-white shadow-[-10px_0_20px_-10px_rgba(0,0,0,0.05)] z-40">

        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-40 h-[64px]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              title="Toggle Sidebar"
            >
              <Menu size={22} />
            </button>
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center border border-amber-200 shrink-0 hidden sm:flex">
              <Globe size={16} className="text-amber-600" />
            </div>
            <h1 className="text-[14px] font-bold text-slate-700 hidden sm:block tracking-tight">Tools Suggest ONC by SHP</h1>
          </div>

          <div className="flex-1 max-w-lg mx-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={activeMenu === 'map' ? "Search Map of Location" : "Search Data..."}
                className="w-full bg-slate-100 rounded-lg py-2 pl-10 pr-4 text-sm outline-none border border-transparent focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button onClick={fetchData} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors" title="Sync Data">
              <RefreshCw size={18} className={loading ? 'animate-spin text-blue-600' : ''} />
            </button>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">S</div>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto bg-[#f8fafc]">

          <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30 shadow-sm flex items-center gap-2">
            {menuItems.find(m => m.id === activeMenu)?.icon && React.createElement(menuItems.find(m => m.id === activeMenu).icon, { size: 18, className: "text-slate-400" })}
            <h2 className="text-sm font-bold text-slate-700 tracking-wide uppercase">
              {menuItems.find(m => m.id === activeMenu)?.label}
            </h2>
          </div>

          <div className="p-4 md:p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
                <RefreshCw size={40} className="animate-spin mb-4 text-blue-400" />
                <p className="font-bold text-xs uppercase tracking-widest text-slate-500">Menarik Data Terbaru...</p>
              </div>
            ) : (
              <>
                {/* VIEW 1: LIST VALIDASI */}
                {activeMenu === 'list' && (
                  <div className="max-w-7xl mx-auto">

                    {/* Dashboard Quick Stats & Filter */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in duration-500">
                      <div className="flex gap-4 sm:gap-8 justify-around md:justify-start flex-1 px-2">
                        <div className="text-center md:text-left">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-center md:justify-start gap-1"><BarChart3 size={12} /> Total Toko</p>
                          <h4 className="text-2xl font-black text-slate-800 leading-none">{stores.length}</h4>
                        </div>
                        <div className="w-px bg-slate-200"></div>
                        <div className="text-center md:text-left">
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1 flex items-center justify-center md:justify-start gap-1"><CheckCircle2 size={12} /> Disurvei</p>
                          <h4 className="text-2xl font-black text-emerald-600 leading-none">{successStores.length}</h4>
                        </div>
                        <div className="w-px bg-slate-200"></div>
                        <div className="text-center md:text-left">
                          <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-1 flex items-center justify-center md:justify-start gap-1"><Target size={12} /> Sisa Target</p>
                          <h4 className="text-2xl font-black text-rose-500 leading-none">{stores.length - successStores.length}</h4>
                        </div>
                      </div>

                      <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 shrink-0">
                        {['all', 'pending', 'done'].map((status) => (
                          <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${statusFilter === status ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            {status === 'all' ? 'Semua' : status === 'pending' ? 'Belum' : 'Selesai'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {Object.keys(groupedData).map(region => (
                      <div key={region} className="mb-10 animate-in fade-in duration-500">
                        <div className="flex items-center gap-3 mb-4">
                          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{region}</h3>
                          <span className="text-[10px] font-bold bg-slate-200 px-2 py-0.5 rounded-full text-slate-600">{groupedData[region].length} TOKO</span>
                          <div className="h-px bg-slate-200 flex-1 ml-2" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                          {groupedData[region].map(store => (
                            <StoreCard key={store.id} store={store} onClick={(s) => { setSelectedStore(s); setIsFormOpen(true); }} />
                          ))}
                        </div>
                      </div>
                    ))}
                    {Object.keys(groupedData).length === 0 && (
                      <div className="flex flex-col items-center justify-center h-[30vh] text-slate-400">
                        <Filter size={48} className="mb-4 opacity-20" />
                        <p className="font-bold text-sm text-slate-500">Tidak ada toko yang sesuai dengan filter/pencarian.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW 2: MAP OF LOCATION */}
                {activeMenu === 'map' && (
                  <div className="w-full h-[calc(100vh-160px)] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative animate-in fade-in zoom-in-95 duration-500 flex">
                    <div className="flex-1 relative h-full">
                      <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg border border-slate-200 flex overflow-hidden">
                        <button className="px-5 py-2 text-[11px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 border-r border-slate-200 hover:bg-slate-200 transition-colors">Peta</button>
                        <button className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 transition-colors">Satelit</button>
                      </div>
                      <GlobalMap stores={stores} onMarkerClick={setSelectedMapStore} />
                    </div>

                    {/* SIDE PANEL DETAIL TOKO */}
                    {selectedMapStore && (
                      <div className="absolute md:relative right-0 top-0 h-full w-full md:w-80 lg:w-[380px] bg-white border-l border-slate-200 flex flex-col z-[1001] animate-in slide-in-from-right-8 duration-300 shadow-2xl md:shadow-none">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50 sticky top-0">
                          <div className="flex flex-col pr-2">
                            <h3 className="font-black text-slate-800 uppercase text-sm leading-tight">{selectedMapStore.name}</h3>
                            <span className="text-[10px] font-bold text-slate-500 mt-1">{selectedMapStore.Region}</span>
                          </div>
                          <button onClick={() => setSelectedMapStore(null)} className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-slate-600 rounded-md shadow-sm transition-colors">
                            <X size={16} />
                          </button>
                        </div>

                        {/* Body Panel (Isi Spreadsheet) */}
                        <div className="flex-1 overflow-y-auto p-0 bg-slate-50/30">

                          {/* Jika Toko Sudah Disurvei (Ada Foto) */}
                          {selectedMapStore.photo && (
                            <div className="p-4 pb-0 animate-in fade-in duration-500">
                              <div className="w-full h-48 bg-slate-100 rounded-xl overflow-hidden shadow-sm border border-slate-200 relative group">
                                <img src={selectedMapStore.photo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Foto Toko" />
                                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm">
                                  <User size={10} /> {selectedMapStore.surveyor}
                                </div>
                                <div className="absolute bottom-2 right-2 bg-emerald-500/90 backdrop-blur-md text-white px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 shadow-sm">
                                  <CheckCircle2 size={10} /> {selectedMapStore.timestamp?.split(',')[0]}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="p-4">
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                              <table className="w-full text-left text-xs">
                                <tbody className="divide-y divide-slate-100">
                                  {Object.entries(selectedMapStore).map(([key, value]) => {
                                    // Sembunyikan field sistem/internal dari tabel (Termasuk rawPhotoUrl & name/Region karena sudah di header)
                                    if (['id', 'isDone', 'latitude', 'longitude', 'photo', 'surveyor', 'timestamp', 'rawPhotoUrl', 'name', 'Region', 'Link Foto', 'Foto Toko', 'Ttd Toko'].includes(key)) return null;

                                    // Jika value kosong, skip baris ini agar tabel lebih rapi
                                    if (!value || value === '-') return null;

                                    return (
                                      <tr key={key} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="p-3 py-2.5 font-bold text-slate-500 w-[40%] align-top capitalize">{key.replace(/_/g, ' ')}</td>
                                        <td className="p-3 py-2.5 font-medium text-slate-800 break-words">
                                          {key.toLowerCase() === 'onc' || key === 'ONC?' ? (
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${value === 'Yes' ? 'bg-purple-100 text-purple-600' : 'bg-rose-100 text-rose-600'}`}>
                                              {value}
                                            </span>
                                          ) : (
                                            value
                                          )}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                  {/* Tampilkan Koordinat secara khusus */}
                                  <tr className="hover:bg-blue-50/50 transition-colors">
                                    <td className="p-3 py-2.5 font-bold text-slate-500 w-[40%] align-top">Koordinat</td>
                                    <td className="p-3 py-2.5 font-medium text-slate-800 break-words flex flex-col gap-1">
                                      <span>{selectedMapStore.latitude}, {selectedMapStore.longitude}</span>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 space-y-2.5 bg-white sticky bottom-0">
                          <button
                            onClick={() => { setSelectedStore(selectedMapStore); setIsFormOpen(true); }}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-md shadow-blue-200 hover:bg-blue-700 hover:shadow-lg transition-all active:scale-[0.98]"
                          >
                            <CheckSquare size={16} /> Mulai Survei Toko Ini
                          </button>
                          <button
                            onClick={() => openInGoogleMaps(selectedMapStore.latitude, selectedMapStore.longitude)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-700 py-3 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-slate-100 transition-all active:scale-[0.98]"
                          >
                            <Navigation size={16} className="text-blue-500" /> Direct ke Google Maps
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW 3: DATA GALLERY */}
                {activeMenu === 'gallery' && (
                  <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
                    {galleryStores.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
                        <ImageIcon size={64} className="mb-4 opacity-20 text-slate-300" />
                        <p className="font-bold text-sm text-slate-500">Belum ada foto survei yang tersimpan.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {galleryStores.map(store => {
                          const distanceStrGallery = store['Jarak Validasi'] || store.distanceValidation || '-';
                          const isFarGallery = checkDistanceWarning(distanceStrGallery);

                          return (
                            <div
                              key={store.id}
                              onClick={() => setSelectedGalleryStore(store)}
                              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-all cursor-pointer relative"
                              title="Klik untuk perbesar gambar"
                            >
                              {/* Indikator ONC */}
                              {(store.onc === 'Yes' || store.onc === 'No') && (
                                <div className={`absolute top-2 left-2 z-10 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shadow-sm ${store.onc === 'Yes' ? 'bg-purple-500' : 'bg-rose-500'}`}>
                                  ONC: {store.onc}
                                </div>
                              )}
                              <div className="h-40 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                                <img src={store.photo} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={store.name} />
                                <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-white text-[9px] font-bold px-2 py-1 rounded-md border border-white/10">
                                  {formatDateTime(store.timestamp)}
                                </div>
                              </div>
                              <div className="p-3">
                                <h4 className="font-bold text-xs uppercase truncate text-slate-800">{store.name}</h4>
                                <div className="flex justify-between items-center mt-1">
                                  <p className="text-[10px] text-slate-500 truncate font-medium">By: {store.surveyor}</p>
                                  <p className={`text-[9px] font-black tracking-wide ${isFarGallery ? 'text-rose-500' : 'text-emerald-500'}`}>{distanceStrGallery}</p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW 4: LIST TOKO SUKSES TERVALIDASI */}
                {activeMenu === 'success' && (
                  <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
                      <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">List Toko Tervalidasi</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Total: {successStores.length} Toko</p>
                      </div>
                      {successStores.length > 0 && (
                        <button onClick={handleExportCSV} className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-emerald-200">
                          <Download size={16} /> Export Data (.CSV)
                        </button>
                      )}
                    </div>

                    {successStores.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-[40vh] text-slate-400">
                        <CheckSquare size={64} className="mb-4 opacity-20 text-slate-300" />
                        <p className="font-bold text-sm text-slate-500">Belum ada toko yang tervalidasi.</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-black text-slate-400 tracking-wider">
                              <tr>
                                <th className="p-4 pl-6">Nama Toko</th>
                                <th className="p-4">Region</th>
                                <th className="p-4">Surveyor</th>
                                <th className="p-4">Waktu Validasi</th>
                                <th className="p-4">Jarak Validasi</th>
                                <th className="p-4 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {successStores.map(store => {
                                const distanceStrSuccessTab = store['Jarak Validasi'] || store.distanceValidation || '-';
                                const isFarSuccessTab = checkDistanceWarning(distanceStrSuccessTab);

                                return (
                                  <tr
                                    key={store.id}
                                    onClick={() => setSelectedSuccessStore(store)}
                                    className="hover:bg-blue-50 transition-colors cursor-pointer group"
                                    title="Klik untuk lihat detail gambar"
                                  >
                                    <td className="p-4 pl-6 font-bold text-slate-800 text-xs uppercase group-hover:text-blue-600 transition-colors">
                                      {store.name}
                                      {(store.onc === 'Yes' || store.onc === 'No') && (
                                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest align-middle ${store.onc === 'Yes' ? 'bg-purple-100 text-purple-600' : 'bg-rose-100 text-rose-600'}`}>
                                          ONC: {store.onc}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-4 text-xs text-slate-500">{store.Region}</td>
                                    <td className="p-4 text-xs font-medium text-slate-700">{store.surveyor}</td>
                                    <td className="p-4 text-xs text-slate-500">{formatDateTime(store.timestamp)}</td>
                                    <td className={`p-4 text-xs font-bold ${isFarSuccessTab ? 'text-rose-500' : 'text-emerald-600'}`}>{distanceStrSuccessTab}</td>
                                    <td className="p-4 text-center">
                                      <div className="inline-flex items-center justify-center bg-emerald-100 text-emerald-600 p-1.5 rounded-full">
                                        <Check size={14} strokeWidth={3} />
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW 5: ABOUT (TENTANG APLIKASI) */}
                {activeMenu === 'about' && (
                  <div className="max-w-3xl mx-auto animate-in fade-in duration-500 pt-4">
                    <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden">
                      {/* Banner Header */}
                      <div className="h-32 bg-gradient-to-r from-blue-600 to-cyan-500 relative">
                        <div className="absolute -bottom-10 left-8 w-20 h-20 bg-white rounded-2xl shadow-md border-4 border-white flex items-center justify-center z-10">
                          <Globe size={40} className="text-blue-500" />
                        </div>
                        <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/30 text-white text-[10px] font-black uppercase tracking-widest">
                          Versi 1.0.0
                        </div>
                      </div>

                      {/* Content About */}
                      <div className="pt-16 p-8">
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2 uppercase">Aplikasi Survei & Validasi Toko</h3>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
                          Sistem informasi berbasis Geographic Information System (GIS) yang dirancang khusus untuk mempermudah proses pemetaan, pencatatan data lapangan, pengambilan dokumentasi, dan validasi lokasi toko secara real-time yang terintegrasi penuh dengan Cloud (Google Workspace).
                        </p>

                        {/* Info Cards */}
                        <div className="grid sm:grid-cols-2 gap-4 mb-8">
                          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex gap-4 items-center">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                              <ShieldCheck size={24} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Project Name</p>
                              <p className="text-sm font-bold text-slate-700 leading-tight">Tools Suggest ONC<br />by SHP</p>
                            </div>
                          </div>

                          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-4 items-center">
                            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-200">
                              <User size={24} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-0.5">Developed & Designed By</p>
                              <p className="text-sm font-black text-blue-900 uppercase">Suryo Hadi Prakoso</p>
                            </div>
                          </div>
                        </div>

                        {/* Fitur Utama List */}
                        <div className="border-t border-slate-100 pt-6">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Fitur Utama Sistem</h4>
                          <div className="grid sm:grid-cols-2 gap-y-3 gap-x-6">
                            {[
                              'Global Map & Cluster Location', 'Smart Location Validasi (Haversine)',
                              'Real-time Cloud Sync Database', 'Direct Photo & Signature Capture',
                              'Fallback GPS Mode', 'Live Dashboard & Data Gallery'
                            ].map((feature, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                                <span className="text-xs font-bold text-slate-600">{feature}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW 6: FEEDBACK */}
                {activeMenu === 'feedback' && (
                  <div className="max-w-3xl mx-auto animate-in fade-in duration-500 pt-4">
                    <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden p-6 md:p-10">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100">
                          <MessageSquare size={28} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Kirim Feedback</h3>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Bantu kami menjadi lebih baik</p>
                        </div>
                      </div>

                      <form onSubmit={(e) => {
                        e.preventDefault();
                        alert('Terima kasih! Feedback Anda telah berhasil dikirim ke tim Developer.');
                        e.target.reset();
                      }}>
                        <div className="space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Nama Anda</label>
                              <input type="text" required placeholder="Masukkan nama..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Kategori Feedback</label>
                              <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-700">
                                <option>Kendala / Bug Aplikasi</option>
                                <option>Saran Fitur Baru</option>
                                <option>Pembaruan Data Toko</option>
                                <option>Lainnya</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 px-1">Pesan / Detail Kendala</label>
                            <textarea rows="5" required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none" placeholder="Ceritakan pengalaman, kendala, atau saran Anda secara detail di sini..."></textarea>
                          </div>
                          <div className="pt-2">
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-sm uppercase tracking-wider py-4 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                              <Send size={18} /> Kirim Feedback Sekarang
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* VIEW LAINNYA (Placeholder) */}
                {['apps'].includes(activeMenu) && (
                  <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
                    <AlertTriangle size={48} className="mb-4 opacity-20" />
                    <p className="font-medium text-sm">Halaman sedang dalam pengembangan.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* =========================================================
          SEMUA MODAL / POP-UP DIPINDAHKAN KE SINI (ROOT LEVEL)
          ========================================================= */}

      {/* MODAL DETAIL TOKO SUKSES */}
      {selectedSuccessStore && (() => {
        const distanceStrSuccess = selectedSuccessStore['Jarak Validasi'] || selectedSuccessStore.distanceValidation || 'N/A';
        const isFarSuccess = checkDistanceWarning(distanceStrSuccess);

        return (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl flex flex-col max-h-[96vh] overflow-hidden border border-slate-100">
              <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-white sticky top-0 z-10">
                <div className="pr-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-blue-600 uppercase text-lg leading-tight">{selectedSuccessStore.name}</h3>
                    {(selectedSuccessStore.onc === 'Yes' || selectedSuccessStore.onc === 'No') && (
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${selectedSuccessStore.onc === 'Yes' ? 'bg-purple-100 text-purple-600' : 'bg-rose-100 text-rose-600'}`}>
                        ONC: {selectedSuccessStore.onc}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Tervalidasi pada {selectedSuccessStore.timestamp?.split(',')[0]}</p>
                </div>
                <button onClick={() => setSelectedSuccessStore(null)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors shrink-0"><X size={20} className="text-slate-500" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Foto Toko */}
                {selectedSuccessStore.photo ? (
                  <div className="w-full h-64 bg-slate-100/80 rounded-2xl overflow-hidden shadow-inner border border-slate-200 flex items-center justify-center p-2">
                    <img src={selectedSuccessStore.photo} className="w-full h-full object-contain rounded-xl drop-shadow-sm" alt="Foto Toko" />
                  </div>
                ) : (
                  <div className="w-full h-32 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-400">Tidak ada foto</span>
                  </div>
                )}

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><User size={12} /> Surveyor</p>
                    <p className="text-xs font-black text-slate-700 uppercase">{selectedSuccessStore.surveyor}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><MapPin size={12} /> Jarak Validasi</p>
                    <p className={`text-xs font-black ${isFarSuccess ? 'text-rose-500' : 'text-emerald-600'}`}>
                      {distanceStrSuccess}
                    </p>
                  </div>
                </div>

                {/* Keterangan */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Info size={12} /> Alamat Lengkap & Keterangan</p>
                  <p className="text-xs font-medium text-slate-700 leading-relaxed mb-2">{selectedSuccessStore.address}</p>
                  {selectedSuccessStore['Catatan'] && (
                    <p className="text-xs font-bold text-slate-600 italic bg-white p-2 border border-slate-100 rounded-md">"{selectedSuccessStore['Catatan']}"</p>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 sticky bottom-0 flex gap-3">
                <button
                  onClick={() => openInGoogleMaps(selectedSuccessStore.latitude, selectedSuccessStore.longitude)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-blue-200"
                >
                  <Navigation size={16} /> Navigasi Maps
                </button>
                <button
                  onClick={() => setSelectedSuccessStore(null)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs uppercase py-3.5 rounded-xl transition-colors active:scale-95"
                >
                  Tutup Detail
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL LIGHTBOX GALLERY (POP-UP FOTO BESAR) */}
      {selectedGalleryStore && (() => {
        const distanceStrLight = selectedGalleryStore['Jarak Validasi'] || selectedGalleryStore.distanceValidation || '-';
        const isFarLight = checkDistanceWarning(distanceStrLight);

        return (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">

            <button
              onClick={() => setSelectedGalleryStore(null)}
              className="absolute top-4 right-4 md:top-6 md:right-8 p-3 bg-white/10 hover:bg-white/20 hover:scale-110 rounded-full backdrop-blur-md transition-all z-50 group shadow-lg border border-white/10"
              title="Tutup (Esc)"
            >
              <X size={28} className="text-white group-hover:rotate-90 transition-transform duration-300" />
            </button>

            <div className="relative w-full max-w-6xl h-full flex flex-col items-center justify-center p-4 md:p-8">

              <div className="relative flex-1 w-full flex items-center justify-center min-h-0 mb-4 md:mb-6">
                <img
                  src={selectedGalleryStore.photo ? selectedGalleryStore.photo.replace('sz=w800', 'sz=w1600') : ''}
                  className="max-w-full max-h-full object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-500 rounded-lg"
                  alt={selectedGalleryStore.name}
                />
              </div>

              <div className="w-full max-w-3xl bg-white/10 backdrop-blur-md border border-white/20 p-5 md:p-6 rounded-2xl text-white shadow-2xl animate-in slide-in-from-bottom-8 duration-500 shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div className="flex-1">
                    <h3 className="font-black uppercase text-2xl md:text-3xl tracking-tight leading-none mb-3 text-white drop-shadow-md flex items-center gap-3">
                      {selectedGalleryStore.name}
                      {(selectedGalleryStore.onc === 'Yes' || selectedGalleryStore.onc === 'No') && (
                        <span className={`text-white px-2 py-1 rounded-lg text-xs font-black tracking-widest align-middle border ${selectedGalleryStore.onc === 'Yes' ? 'bg-purple-500/80 border-purple-400/50' : 'bg-rose-500/80 border-rose-400/50'}`}>
                          ONC: {selectedGalleryStore.onc}
                        </span>
                      )}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <p className="text-slate-200 text-xs font-bold tracking-widest uppercase flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/10">
                        <MapPin size={14} className="text-rose-400" /> {selectedGalleryStore.Region}
                      </p>
                      <span className="text-xs font-bold bg-white/10 text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-white/10">
                        <User size={14} className="text-blue-300" /> {selectedGalleryStore.surveyor}
                      </span>
                      <span className="text-xs font-medium bg-white/10 text-slate-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-white/10">
                        <CheckCircle2 size={14} className="text-emerald-400" /> {formatDateTime(selectedGalleryStore.timestamp)}
                      </span>
                      <span className={`text-xs font-bold bg-white/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-white/10 ${isFarLight ? 'text-rose-400' : 'text-emerald-400'}`}>
                        <Navigation size={14} /> Jarak: {distanceStrLight}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 pt-3 md:pt-0 border-t border-white/10 md:border-t-0 mt-2 md:mt-0">
                    <button
                      onClick={() => openInGoogleMaps(selectedGalleryStore.latitude, selectedGalleryStore.longitude)}
                      className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase px-6 py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.4)] border border-blue-400/50"
                    >
                      <Navigation size={16} /> Navigasi Maps
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL FORM SURVEI */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[24px] shadow-2xl flex flex-col max-h-[96vh] overflow-hidden border border-slate-100">
            <div className="p-6 px-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex flex-col">
                <h3 className="font-black text-blue-600 uppercase text-xl leading-tight tracking-tight">{selectedStore?.name}</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{selectedStore?.Region}</p>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 px-8 space-y-6">
              <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center text-blue-600"><Info size={12} /></div>
                  <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">LOKASI SPREADSHEET</p>
                </div>
                <p className="text-xs text-slate-600 mb-5 font-semibold leading-relaxed px-1">{selectedStore?.address || 'Alamat tidak ditemukan'}</p>
                <button
                  onClick={() => openInGoogleMaps(selectedStore?.latitude, selectedStore?.longitude)}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white w-full py-3.5 rounded-xl text-[12px] font-bold uppercase shadow-md transition-colors"
                >
                  <Navigation size={16} fill="white" /> Navigasi ke Lokasi
                </button>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block px-1">NAMA SURVEYOR*</label>
                  <input type="text" placeholder="Masukkan Nama Lengkap" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800 transition-all" value={formData.surveyorName} onChange={(e) => setFormData({ ...formData, surveyorName: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block px-1">NAMA TOKO AKTUAL (UPDATE JIKA BERUBAH)</label>
                  <input type="text" placeholder="Masukkan nama toko aktual..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-800 transition-all" value={formData.updatedStoreName} onChange={(e) => setFormData({ ...formData, updatedStoreName: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block px-1">VISIT STATUS*</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-medium outline-none text-slate-800 focus:ring-2 focus:ring-blue-500" value={formData.visitStatus} onChange={(e) => setFormData({ ...formData, visitStatus: e.target.value })}>
                      <option>Sudah Tersurvei</option><option>Belum Tersurvei</option><option>Toko Tutup</option><option>Pindah Lokasi</option>
                    </select>
                  </div>
                  <div className="space-y-2 text-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">ONC?*</label>
                    <div className="flex gap-2">
                      {['Yes', 'No'].map(v => (
                        <button key={v} type="button" onClick={() => setFormData({ ...formData, onc: v })} className={`flex-1 py-3.5 rounded-xl text-xs font-bold transition-all border ${formData.onc === v ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{v}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {formData.onc === 'Yes' && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block px-1">ALASAN ONC</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-medium outline-none text-slate-800 focus:ring-2 focus:ring-blue-500" value={formData.oncReason} onChange={(e) => setFormData({ ...formData, oncReason: e.target.value })}>
                      <option value="">Pilih Alasan...</option><option>Customer Baru</option><option>Potensi Besar</option><option>Lokasi Strategis</option>
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block px-1">KETERANGAN VISIT</label>
                  <textarea rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-medium outline-none text-slate-800 focus:ring-2 focus:ring-blue-500" placeholder="Tambahkan hasil observasi..." value={formData.visitNotes} onChange={(e) => setFormData({ ...formData, visitNotes: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5 pt-4 border-t border-slate-100">
                <div className="space-y-2.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 tracking-widest px-1"><Camera size={12} className="text-blue-500" /> FOTO TOKO*</label>
                  <label className="relative border-2 border-dashed border-slate-300 rounded-2xl h-40 flex flex-col items-center justify-center bg-slate-50 overflow-hidden group cursor-pointer active:scale-[0.98] transition-transform">
                    {formData.photo ? (
                      <img src={formData.photo} className="w-full h-full object-cover" alt="Captured shop" />
                    ) : (
                      <div className="text-center p-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2 text-blue-600">
                          <Camera size={20} />
                        </div>
                        <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">BUKA KAMERA</p>
                      </div>
                    )}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setFormData(prev => ({ ...prev, photo: reader.result }));
                        reader.readAsDataURL(file);
                      }
                    }}
                    />
                  </label>
                </div>

                <div className="space-y-2.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 tracking-widest px-1"><Crosshair size={12} className="text-rose-500" /> LOKASI GPS*</label>
                  <div className="h-40 flex flex-col items-center justify-center bg-slate-50 rounded-2xl p-2 border border-slate-200 overflow-hidden relative group">
                    {formData.gpsLoading ? (
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="animate-spin text-blue-500" size={24} />
                        <p className="text-[8px] font-bold text-blue-500 uppercase tracking-widest">Melacak Sinyal...</p>
                      </div>
                    ) : (
                      <div className="text-center w-full h-full flex flex-col items-center justify-center">
                        {formData.gps.lat ? (
                          <>
                            <LeafletMap lat={formData.gps.lat} lng={formData.gps.lng} onPosChange={(lat, lng) => setFormData(prev => ({ ...prev, gps: { lat, lng } }))} />
                            {(() => {
                              const dist = calculateDistance(formData.gps.lat, formData.gps.lng, parseFloat(selectedStore?.latitude), parseFloat(selectedStore?.longitude));
                              if (dist !== null) {
                                const isFar = dist > 50; // UPDATE: Batas toleransi diubah jadi 50m
                                return (
                                  <div className={`absolute top-2 right-2 backdrop-blur-md px-2 py-1 rounded-lg shadow-sm border flex items-center gap-1 z-[1000] ${isFar ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
                                    <MapPin size={10} className={isFar ? 'text-rose-500' : 'text-emerald-500'} />
                                    <span className="text-[9px] font-bold text-slate-700">Jarak: <span className={isFar ? 'text-rose-600' : 'text-emerald-600'}>{dist < 1000 ? `${dist} m` : `${(dist / 1000).toFixed(2)} km`}</span></span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                            <p className="absolute bottom-2 left-2 bg-white/90 px-2 py-1 rounded text-[8px] font-bold text-slate-500 z-[1000] border border-slate-200 shadow-sm pointer-events-none">Geser Pin Peta</p>
                            <button type="button" onClick={getLocation} className="absolute bottom-2 right-2 bg-white/90 p-1.5 rounded-md shadow-sm border border-slate-200 text-blue-600 hover:bg-blue-50 active:scale-95 transition-all z-[1000]"><RotateCcw size={14} /></button>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-2 w-full px-2">
                            <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest text-center">
                              {gpsError || "GPS MATI"}
                            </p>
                            <button type="button" onClick={getLocation} className="bg-blue-600 p-2.5 rounded-full shadow-md text-white hover:bg-blue-700 active:scale-95 transition-all">
                              <RotateCcw size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pb-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 tracking-widest px-1"><PenTool size={12} className="text-emerald-500" /> TANDA TANGAN VALIDASI</label>
                <SignaturePad onSave={(s) => setFormData(prev => ({ ...prev, signature: s }))} />
              </div>
            </div>

            <div className="p-5 px-8 border-t border-slate-100 bg-slate-50/50 sticky bottom-0 z-10">
              {!isFormValid && (
                <div className="flex items-center justify-center gap-1.5 mb-3">
                  <AlertTriangle size={12} className="text-amber-500" />
                  <p className="text-[9px] text-amber-600 font-bold uppercase tracking-widest text-center">
                    WAJIB DIISI: {formData.surveyorName.trim().length <= 1 ? 'NAMA SURVEYOR • ' : ''} {!formData.photo ? 'FOTO TOKO ' : ''}
                    {/* UNTUK TESTING: Hapus comment baris di bawah ini untuk memunculkan kembali warning GPS */}
                    {/* {!formData.gps.lat ? '• LOKASI GPS' : ''} */}
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-3.5 rounded-xl border border-slate-300 font-bold text-xs uppercase text-slate-500 hover:bg-slate-100 transition-all active:scale-95 bg-white shadow-sm">Batal</button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !isFormValid}
                  className={`flex-1 py-3.5 rounded-xl font-bold text-xs uppercase text-white shadow-md transition-all ${!isFormValid || isSubmitting ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
                >
                  {isSubmitting ? <RefreshCw size={16} className="animate-spin mx-auto text-white" /> : "Simpan Laporan"}
                </button>
              </div>
            </div>
          </div>

          {showSuccess && (
            <div className="absolute inset-0 z-[110] bg-white/95 flex flex-col items-center justify-center animate-in zoom-in duration-300 text-center p-8">
              <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-200 animate-bounce"><Check size={48} strokeWidth={4} /></div>
              <h4 className="text-2xl font-black uppercase tracking-tight text-emerald-600">Terima Kasih!</h4>
              <p className="text-slate-500 text-xs font-medium mt-2">Laporan sedang disinkronisasi ke Cloud</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}