import type { Fixture, ServiceDestination, Summary } from '@/interfaces/document';

const official = (id: string, zh: string, idLabel: string, target: string): ServiceDestination => ({
  id,
  kind: 'official',
  label: { 'zh-TW': zh, id: idLabel },
  target
});
const townpass = (id: string, zh: string, idLabel: string): ServiceDestination => ({
  id,
  kind: 'townpass',
  label: { 'zh-TW': zh, id: idLabel }
});

export const applications = townpass('applications', '查看我的申辦案件', 'Lihat permohonan saya');
const findService = townpass('services', '查找相關服務', 'Cari layanan terkait');
export const defaultDestinations = [findService, applications];

const makeSummary = (title: string, facts: string[], action: string): Summary => ({
  title,
  facts,
  action
});
const sitconLinks = [
  official(
    'afar',
    '申請遠道而來票',
    'Ajukan tiket peserta dari jauh',
    'https://i.sitcon.org/afar-form'
  ),
  official(
    'dream',
    '申請開源築夢計畫',
    'Ajukan bantuan perjalanan SITCON',
    'https://i.sitcon.org/dream-form'
  ),
  official('sitcon', '查看年會資訊', 'Lihat informasi konferensi', 'https://sitcon.org/'),
  applications
];
const sitconZh = [
  '對象：符合方案資格的在學學生。',
  '時間與地點：2027/03/13，中央研究院人文社會科學館。',
  '票種：遠道而來票不含交通住宿補助；開源築夢計畫依規定提供補助。',
  '期限：獲邀請碼後須在 2027/02/05 前完成正式報名；申請期限依各方案公告。',
  '準備：依所選方案檢附證明，填寫線上表單。'
];
const sitconId = [
  'Peserta: siswa atau mahasiswa aktif yang memenuhi syarat program.',
  'Waktu dan tempat: 13 Maret 2027, Gedung Humaniora dan Ilmu Sosial Academia Sinica.',
  'Tiket peserta dari jauh tidak mencakup transportasi dan penginapan. Program bantuan SITCON mencakup biaya sesuai ketentuan.',
  'Setelah mendapat kode undangan, daftar resmi sebelum 5 Februari 2027. Batas pengajuan mengikuti pengumuman program.',
  'Siapkan bukti sesuai syarat program dan isi formulir daring.'
];

export const fixtures: Fixture[] = [
  {
    id: 'sitcon-schools',
    kind: 'pdf',
    file: '開字第_11511040002_號_教育部國民及學前教育署函.pdf',
    hash: '3f0354e87fde6df6666396810a799852b93a11c33c0751846595f924cb8bdfdc',
    date: '2026-11-04',
    status: 'due-soon',
    scenarioDate: '2027-02-03',
    summaries: {
      'zh-TW': makeSummary(
        'SITCON 2027 學生票與交通住宿補助',
        sitconZh,
        '選擇適合的方案提出申請；通過後持邀請碼完成正式報名。'
      ),
      id: makeSummary(
        'Tiket pelajar dan bantuan perjalanan SITCON 2027',
        sitconId,
        'Ajukan program yang sesuai. Jika lolos, daftar resmi dengan kode undangan.'
      )
    },
    destinations: sitconLinks
  },
  {
    id: 'youth-reimbursement',
    kind: 'pdf',
    file: '來文.pdf',
    hash: '53f2ecfc1a75e732612a2adde8f5bd22242299fb9711a03bc45cb3697703ffdd',
    date: '2023-08-30',
    status: 'completed',
    summaries: {
      'zh-TW': makeSummary(
        '青年多元文化活動補助核銷通知',
        [
          '對象：承辦迎新活動的國立中央大學。',
          '核定補助：新臺幣 2 萬元，依核定項目及額度核銷。',
          '期限：原函要求於 2023/10/23 前檢送。',
          '準備：核定函影本、領據、支用明細、支出憑證、簽到冊與成果報告等。',
          '活動文宣須標明青年事務局為指導機關。'
        ],
        '備齊核銷資料，依原函要求向桃園市政府辦理。'
      ),
      id: makeSummary(
        'Pemberitahuan pertanggungjawaban subsidi kegiatan pemuda',
        [
          'Penerima: National Central University untuk kegiatan orientasi.',
          'Subsidi disetujui sebesar NT$20.000 untuk pos pengeluaran yang telah ditetapkan.',
          'Batas pada surat: 23 Oktober 2023.',
          'Siapkan salinan persetujuan, kuitansi, rincian pengeluaran, bukti pembayaran, daftar hadir dan laporan.',
          'Materi publikasi harus mencantumkan Dinas Pemuda sebagai pembina.'
        ],
        'Siapkan dokumen pertanggungjawaban dan ikuti petunjuk Pemerintah Kota Taoyuan.'
      )
    },
    destinations: [
      townpass('reimbursement', '開啟補助核銷申請', 'Buka permohonan pertanggungjawaban subsidi'),
      applications
    ]
  },
  {
    id: 'sitcon-universities',
    kind: 'pdf',
    file: '開字第_11511040001_號_教育部資訊與科技教育司函.pdf',
    hash: 'aced701c2401454eeabfec8e2294e8003c0a5f8f84884b443b4cc9cabd5fa2ba',
    date: '2026-11-04',
    summaries: {
      'zh-TW': makeSummary(
        'SITCON 2027 學生方案轉知函',
        ['發文單位請大專校院等受文單位轉知學生。', ...sitconZh],
        '請師長轉知方案並推薦符合資格的學生；學生自行選擇方案申請。'
      ),
      id: makeSummary(
        'Surat edaran program pelajar SITCON 2027',
        [
          'Penyelenggara meminta perguruan tinggi meneruskan informasi kepada mahasiswa.',
          ...sitconId
        ],
        'Bagikan informasi dan rekomendasikan mahasiswa yang memenuhi syarat agar mereka dapat mengajukan permohonan.'
      )
    },
    destinations: sitconLinks
  },
  {
    id: 'rent-review',
    kind: 'photos',
    file: 'photo_2026-11-07_22-40-06.jpg',
    hash: '947b3f8a6705cfb34f9f2e755fad40ea7d5e68fdb01dedaaabafc90dbe343a57',
    date: '2026-03-23',
    summaries: {
      'zh-TW': makeSummary(
        '租金補貼審查結果通知',
        [
          '對象：收到審查通知的租金補貼申請人。',
          '結果：115 年度中央擴大租金補貼申請未通過。',
          '原因：原函指出承租建物不符合所列建物資格。',
          '原函日期為 2026/03/23，照片可見內容未列後續辦理期限。'
        ],
        '如對結果有疑問，可依原函所列聯絡方式向承辦機關確認。'
      ),
      id: makeSummary(
        'Pemberitahuan hasil pemeriksaan subsidi sewa',
        [
          'Ditujukan kepada pemohon subsidi sewa yang menerima surat.',
          'Permohonan subsidi sewa pusat tahun 2026 tidak disetujui.',
          'Menurut surat, bangunan sewaan tidak memenuhi syarat yang tercantum.',
          'Surat tertanggal 23 Maret 2026. Bagian yang terlihat tidak mencantumkan tenggat tindak lanjut.'
        ],
        'Jika ada pertanyaan, hubungi instansi yang tercantum pada surat.'
      )
    },
    destinations: [
      townpass('housing', '查看住宅補貼相關服務', 'Lihat layanan subsidi perumahan'),
      applications
    ]
  },
  {
    id: 'research',
    kind: 'pdf',
    file: '113.12.25科會綜字1130088064號函.pdf',
    hash: '2577bb84e4085a98f5b54fd388dbee66eb22cd10a0f268d1c652e255c80b0b2c',
    date: '2024-12-25',
    summaries: {
      'zh-TW': makeSummary(
        '國科會大專學生研究計畫補助',
        [
          '對象：符合資格的大專學生、指導教授及申請機構。',
          '期限：機構須於 2025/02/25 前函送國科會。',
          '準備：線上申請書、相關電子文件，以及至少 6 小時學術倫理訓練證明。',
          '機構負責資格審查並彙整申請名冊。'
        ],
        '學生與指導教授上傳資料後，由申請機構彙整並於原函期限前送件。'
      ),
      id: makeSummary(
        'Hibah riset mahasiswa dari NSTC',
        [
          'Untuk mahasiswa, dosen pembimbing, dan institusi yang memenuhi syarat.',
          'Institusi harus mengirim pengajuan ke NSTC sebelum 25 Februari 2025.',
          'Siapkan formulir daring, dokumen elektronik, dan bukti pelatihan etika akademik minimal enam jam.',
          'Institusi memeriksa kelayakan dan menyusun daftar pemohon.'
        ],
        'Unggah dokumen, lalu minta institusi menghimpun dan mengirim pengajuan sebelum tenggat pada surat.'
      )
    },
    destinations: [
      official('nstc', '查看國科會網站', 'Lihat situs NSTC', 'https://www.nstc.gov.tw/'),
      applications
    ]
  },
  {
    id: 'twnog6',
    kind: 'pdf',
    file: '1140323001.pdf',
    hash: '1122b3d41574ae2c76d1a54b2abc70828386f59079f6fc2207baec66ff3ec983',
    date: '2025-03-23',
    summaries: {
      'zh-TW': makeSummary(
        'TWNOG 6 網路維運論壇邀請',
        [
          '對象：大專校院資訊單位及相關科系。',
          '時間與地點：2025/04/18，臺大醫院國際會議中心。',
          '活動包含網路維運技術議程與人才交流。',
          '原函提供學研界 30 組免費報名序號。'
        ],
        '有意參加的單位依原函聯絡方式索取序號，再至報名頁完成報名。'
      ),
      id: makeSummary(
        'Undangan forum operasi jaringan TWNOG 6',
        [
          'Untuk unit TI perguruan tinggi dan jurusan terkait.',
          '18 April 2025 di NTUH International Convention Center.',
          'Forum membahas operasi jaringan dan pertukaran talenta.',
          'Surat menawarkan 30 kode registrasi gratis bagi kalangan akademik.'
        ],
        'Hubungi penyelenggara sesuai surat untuk meminta kode, lalu daftar melalui laman registrasi.'
      )
    },
    destinations: [
      official('twnog6-info', '查看論壇議程', 'Lihat agenda forum', 'https://2025.twnog.net'),
      official(
        'twnog6-registration',
        '開啟論壇報名頁',
        'Buka halaman pendaftaran',
        'https://twnog.kktix.cc/events/2025twnog6'
      )
    ]
  },
  {
    id: 'twnog-leave',
    kind: 'pdf',
    file: '11504160004_中華電信股份有限公司網路技術分公司.pdf',
    hash: '27973b36aecd16942e3c09b4422a9a89fce0c1711c94427e30b9f752d2f1b5d8',
    date: '2026-04-16',
    summaries: {
      'zh-TW': makeSummary(
        'TWNOG 7 籌備人員公假／出差申請函',
        [
          '對象：協助論壇及 IPv6 工作坊的受文單位人員。',
          '論壇：2026/05/15，臺大醫院國際會議中心。',
          '工作坊：2026/05/18 至 05/20，TWNIC 辦公室。',
          '各人出席時段以附表為準。'
        ],
        '請受文單位依附表核准相關人員公假或出差。'
      ),
      id: makeSummary(
        'Permohonan izin dinas panitia TWNOG 7',
        [
          'Untuk staf instansi penerima yang membantu forum dan lokakarya IPv6.',
          'Forum: 15 Mei 2026 di NTUH International Convention Center.',
          'Lokakarya: 18–20 Mei 2026 di kantor TWNIC.',
          'Jadwal setiap petugas mengikuti lampiran surat.'
        ],
        'Instansi penerima diminta menyetujui izin atau perjalanan dinas sesuai lampiran.'
      )
    },
    destinations: [
      official('twnog7', '查看論壇資訊', 'Lihat informasi forum', 'https://2026.twnog.net'),
      official(
        'twnog-workshop',
        '查看 IPv6 工作坊',
        'Lihat lokakarya IPv6',
        'https://workshop.twnog.net'
      )
    ]
  },
  {
    id: 'twnog-fiber',
    kind: 'pdf',
    file: '開字第 11504160002 號_臺大醫院_函.pdf',
    hash: 'dd9006852ff433547047ddfe4930c004d29ae4bd7d7dc05992a02c3d807986f9',
    date: '2026-04-16',
    summaries: {
      'zh-TW': makeSummary(
        'TWNOG 研討會樓內光纖借用函',
        [
          '對象：國立臺灣大學醫學院。',
          '活動：2026/05/15，臺大醫院國際會議中心。',
          '需求：借用 B1 至 4 樓的四芯樓內光纖。',
          '用途：由計資中心連到研討會場地，另有專線連接服務。'
        ],
        '請受文單位確認能否配合借用樓內光纖。'
      ),
      id: makeSummary(
        'Permohonan peminjaman serat optik untuk seminar TWNOG',
        [
          'Penerima: Fakultas Kedokteran National Taiwan University.',
          'Seminar berlangsung 15 Mei 2026 di NTUH International Convention Center.',
          'Panitia meminta empat inti serat optik dari lantai B1 ke lantai 4.',
          'Jalur menghubungkan pusat komputasi dengan lokasi seminar.'
        ],
        'Instansi penerima diminta mengonfirmasi ketersediaan serat optik gedung.'
      )
    },
    destinations: defaultDestinations
  },
  {
    id: 'engineering',
    kind: 'pdf',
    file: 'a096m0000q_1140015289_doc1_1_attach1.pdf',
    hash: '97045be9f00bae28bc7bd4ffb0e255c1ca144b2192994dfca8f60a5f3c4e59db',
    date: '2025-04-18',
    summaries: {
      'zh-TW': makeSummary(
        '中國工程師學會工程論文競賽徵稿',
        [
          '對象：全國各大專院校相關學系學生。',
          '截止：2025/05/31。',
          '準備：依附件格式製作論文摘要；沒有學生分會的學校可由指導教授推薦。',
          '決選：以實體海報報告進行。'
        ],
        '在徵稿期限前上傳論文摘要完成報名。'
      ),
      id: makeSummary(
        'Penerimaan abstrak lomba makalah teknik',
        [
          'Untuk mahasiswa bidang terkait di perguruan tinggi Taiwan.',
          'Batas pengiriman: 31 Mei 2025.',
          'Siapkan abstrak sesuai templat. Untuk kampus tanpa cabang mahasiswa, dosen dapat memberikan rekomendasi.',
          'Final dilaksanakan melalui presentasi poster secara langsung.'
        ],
        'Unggah abstrak sebelum tenggat untuk menyelesaikan pendaftaran.'
      )
    },
    destinations: [
      official(
        'engineering-event',
        '查看競賽網站',
        'Lihat situs lomba',
        'https://sites.google.com/nycu.edu.tw/cia2025'
      ),
      applications
    ]
  },
  {
    id: 'student-activities',
    kind: 'pdf',
    file: '來文 (3).pdf',
    hash: '5fca7a369f770312cffba7bde2ed0e8082e1327ed2d934326fd801621604e953',
    date: '2025-04-15',
    summaries: {
      'zh-TW': makeSummary(
        '學生社團培訓與迎新活動服務函',
        [
          '對象：大專院校、學生會與系學會。',
          '內容：自然悠遊工作室提供幹部訓練、迎新宿營及活動規劃支援。',
          '原函附宣傳海報，未指定申請期限。'
        ],
        '學校可協助轉知社團；有興趣的單位可依原函方式聯絡。'
      ),
      id: makeSummary(
        'Penawaran pelatihan organisasi dan orientasi mahasiswa',
        [
          'Untuk perguruan tinggi, badan mahasiswa, dan himpunan jurusan.',
          'Penyedia menawarkan pelatihan pengurus, perkemahan orientasi, dan bantuan perencanaan.',
          'Surat menyebutkan poster terlampir dan tidak menentukan tenggat pengajuan.'
        ],
        'Kampus dapat meneruskan informasi. Pihak yang berminat dapat menghubungi penyedia sesuai surat.'
      )
    },
    destinations: defaultDestinations
  },
  {
    id: 'innovex',
    kind: 'pdf',
    file: '公文4667抄本(雯聿).pdf',
    hash: '7c480693bc19a7e51e72a3a30e02eb00e1940bd72399021c643afd1c4b2b4e13',
    date: '2025-05-16',
    summaries: {
      'zh-TW': makeSummary(
        'InnoVEX 2025 智領未來館展演邀請',
        [
          '對象：受邀學校學生，正本列國立中央大學電機系。',
          '活動：成果展示與產學媒合。',
          '時間：2025/05/21 14:00–16:00。',
          '地點：台北南港展覽館二館 4 樓智領未來館。'
        ],
        '有意參與展演者可依原函聯絡窗口確認安排。'
      ),
      id: makeSummary(
        'Undangan pameran dan temu mitra InnoVEX 2025',
        [
          'Untuk mahasiswa kampus yang diundang, termasuk Jurusan Teknik Elektro National Central University.',
          'Kegiatan mencakup pameran dan temu mitra industri.',
          '21 Mei 2025 pukul 14.00–16.00.',
          'Lokasi: Taipei Nangang Exhibition Center, Gedung 2 lantai 4.'
        ],
        'Hubungi narahubung pada surat untuk memastikan pengaturan pameran.'
      )
    },
    destinations: defaultDestinations
  },
  {
    id: 'youth-application',
    kind: 'pdf',
    file: '申請書0727_桃園市政府促進青年參與多元文化補助.pdf',
    hash: 'ecf8728308337f8b0421d53c43bcbb187636f447213debc001b94d201acfd975',
    date: '2022-10-18',
    summaries: {
      'zh-TW': makeSummary(
        '桃園青年多元文化補助要點與申請表',
        [
          '對象：原文所列符合資格的桃園團體、學校或 15–35 歲設籍青年。',
          '事項：申請青年參與多元文化活動補助。',
          '原文時程：活動開始 20 日前送達，受理至當年度 11 月底。',
          '準備：申請表、青年參與名冊及利益衝突相關文件。'
        ],
        '先核對原文與承辦機關公告，再備齊附件送件。'
      ),
      id: makeSummary(
        'Pedoman dan formulir subsidi kegiatan budaya pemuda Taoyuan',
        [
          'Untuk organisasi, sekolah, atau pemuda usia 15–35 tahun yang terdaftar di Taoyuan sesuai syarat dokumen.',
          'Subsidi mendukung partisipasi pemuda dalam kegiatan multikultural.',
          'Menurut dokumen, ajukan minimal 20 hari sebelum kegiatan. Penerimaan berakhir pada akhir November.',
          'Siapkan formulir, daftar peserta, dan dokumen terkait konflik kepentingan.'
        ],
        'Periksa dokumen dan pengumuman instansi sebelum menyiapkan serta mengirim lampiran.'
      )
    },
    destinations: [
      townpass('youth-grant', '開啟青年活動補助申請', 'Buka permohonan subsidi pemuda'),
      applications
    ]
  },
  {
    id: 'camp',
    kind: 'pdf',
    file: '簽1150024554借宿.pdf',
    hash: '52b4cfa57a5eccd0c66ec2f326b80bdfa40eadc14b6183f81abae39d1dc0aedf',
    date: '2026-06-15',
    summaries: {
      'zh-TW': makeSummary(
        'SITCON Camp 暑期宿舍借用簽呈',
        [
          '對象：營隊承辦人員與住宿服務單位。',
          '住宿期間：2026/07/06 至 07/12，各日入住需求見原文。',
          '費用：住宿費 99,200 元，另有 3,000 元清潔保證金。',
          '準備：住宿申請繳費表與契約書等文件，最遲入住兩週前開單繳費。'
        ],
        '營隊承辦人員依住宿服務二組意見備齊文件及辦理繳費。'
      ),
      id: makeSummary(
        'Persetujuan internal peminjaman asrama SITCON Camp',
        [
          'Untuk panitia dan unit layanan asrama.',
          'Masa menginap 6–12 Juli 2026. Kebutuhan kamar harian ada pada dokumen.',
          'Biaya NT$99.200 dan uang jaminan kebersihan NT$3.000.',
          'Siapkan formulir pembayaran serta kontrak. Urus tagihan dan pembayaran paling lambat dua minggu sebelum masuk.'
        ],
        'Lengkapi dokumen dan pembayaran sesuai petunjuk unit layanan asrama.'
      )
    },
    destinations: [
      townpass('dorm', '查看場地及住宿申請', 'Lihat permohonan tempat dan asrama'),
      applications
    ]
  },
  {
    id: 'waste',
    kind: 'pdf',
    file: '附件1_NCU校園垃圾分類與資源回收管理辦法_公告公文.pdf',
    hash: '7e490800779f21b706a7bf8710adad346d4b3e03acfc41a8e1fef3c80b39375a',
    date: '2025-06-09',
    summaries: {
      'zh-TW': makeSummary(
        '中央大學校園廢棄物管理辦法',
        [
          '對象：校內各單位、館舍、宿舍及廢棄物清運廠商。',
          '事項：一般垃圾、資源回收與廚餘須分類；實驗室廢棄物另依規定處理。',
          '地點：各館舍依規設置有明確標示的分類回收點。',
          '各單位應依分工執行，分類回收流程、路徑及時間另訂。'
        ],
        '投放前確認分類及回收點，實驗室廢棄物交由負責單位依規處理。'
      ),
      id: makeSummary(
        'Pedoman pengelolaan limbah kampus National Central University',
        [
          'Untuk unit kampus, pengelola gedung dan asrama, serta pengangkut sampah.',
          'Pisahkan sampah umum, bahan daur ulang, dan sisa makanan. Limbah laboratorium mengikuti aturan tersendiri.',
          'Gedung menyediakan titik pemilahan dengan label yang jelas.',
          'Alur, rute, dan waktu pengumpulan ditetapkan terpisah.'
        ],
        'Periksa kategori dan lokasi pembuangan. Serahkan limbah laboratorium kepada unit yang bertanggung jawab.'
      )
    },
    destinations: defaultDestinations
  }
];
