import { AudioGuide } from '../../types';

// Dùng các URL mp3 mẫu chất lượng cao, phản hồi nhanh để test trình phát nhạc
const SAMPLE_AUDIO_URLS = {
  vi: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  en: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  ja: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  zh: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
};

export const MOCK_AUDIO_GUIDES: Record<string, AudioGuide> = {
  'audio-001': {
    id: 'audio-001',
    locationId: 'loc-001', // Nhà thờ Đức Bà
    tracks: {
      vi: {
        language: 'vi',
        title: 'Thuyết minh Nhà thờ Đức Bà Sài Gòn',
        narratorName: 'Lê Hương Giang',
        audioUrl: SAMPLE_AUDIO_URLS.vi,
        durationSeconds: 372,
        transcriptText: 'Chào mừng quý khách đến với Nhà thờ Chính tòa Đức Bà Sài Gòn, một trong những kiệt tác kiến trúc cổ kính và biểu tượng lịch sử đặc sắc của Thành phố Hồ Chí Minh. Được khởi công xây dựng vào năm 1877 và hoàn thành vào năm 1880 theo bản thiết kế của kiến trúc sư Jules Bourard...',
      },
      en: {
        language: 'en',
        title: 'Notre-Dame Cathedral Basilica of Saigon Tour',
        narratorName: 'David Miller',
        audioUrl: SAMPLE_AUDIO_URLS.en,
        durationSeconds: 345,
        transcriptText: 'Welcome to the Notre-Dame Cathedral Basilica of Saigon, an architectural masterpiece and cultural landmark in the heart of Ho Chi Minh City. Constructed between 1877 and 1880 under French architect Jules Bourard...',
      },
      ja: {
        language: 'ja',
        title: 'サイゴン大教会（聖母マリア教会）の解説',
        narratorName: '佐藤 健一',
        audioUrl: SAMPLE_AUDIO_URLS.ja,
        durationSeconds: 330,
        transcriptText: 'ホーチミン市の中心部に位置するサイゴン大教会へようこそ。1877年から1880年にかけてフランス植民地時代に建設されたこのネオ・ロマネスク様式の聖堂は、赤レンガの美しい外観が特徴です...',
      },
      zh: {
        language: 'zh',
        title: '西贡圣母圣殿主教座堂解说',
        narratorName: '李思颖',
        audioUrl: SAMPLE_AUDIO_URLS.zh,
        durationSeconds: 350,
        transcriptText: '欢迎来到西贡圣母圣殿主教座堂，俗称红教堂。这座壮丽的教堂建于1877年至1880年间，由法国建筑师朱尔·布拉德设计，是胡志明市最具代表性的历史地标之一...',
      },
    },
  },
  'audio-002': {
    id: 'audio-002',
    locationId: 'loc-002', // Bưu điện Trung tâm
    tracks: {
      vi: {
        language: 'vi',
        title: 'Thuyết minh Bưu điện Trung tâm Sài Gòn',
        narratorName: 'Trần Văn Minh',
        audioUrl: SAMPLE_AUDIO_URLS.vi,
        durationSeconds: 290,
        transcriptText: 'Bưu điện Trung tâm Sài Gòn tọa lạc ngay đối diện Nhà thờ Đức Bà, được xây dựng từ năm 1886 đến 1891 theo phong cách kiến trúc Phục Hưng kết hợp Gothic Pháp và đường nét trang trí phương Đông độc đáo...',
      },
      en: {
        language: 'en',
        title: 'Saigon Central Post Office Audio Guide',
        narratorName: 'Sarah Jenkins',
        audioUrl: SAMPLE_AUDIO_URLS.en,
        durationSeconds: 280,
        transcriptText: 'Located directly across from Notre-Dame Cathedral, the Saigon Central Post Office was constructed between 1886 and 1891. Its captivating design reflects Renaissance and French Gothic traditions...',
      },
      ja: {
        language: 'ja',
        title: 'サイゴン中央郵便局のガイド',
        narratorName: '高橋 美咲',
        audioUrl: SAMPLE_AUDIO_URLS.ja,
        durationSeconds: 275,
        transcriptText: 'サイゴン中央郵便局は、1886年から1891年にかけて建てられた歴史ある郵便局です。ギュスターヴ・エッフェルの影響を受けた美しい鉄骨アーチ天井が訪れる人々を魅了します...',
      },
      zh: {
        language: 'zh',
        title: '西贡中央邮局导览',
        narratorName: '王凯',
        audioUrl: SAMPLE_AUDIO_URLS.zh,
        durationSeconds: 285,
        transcriptText: '西贡中央邮局建于1886年至1891年间，正对红教堂。这座宏伟的建筑拥有高耸的穹顶与富有历史气息的复古电话亭，至今仍作为正常邮局运营...',
      },
    },
  },
  'audio-003': {
    id: 'audio-003',
    locationId: 'loc-003', // Dinh Độc Lập
    tracks: {
      vi: {
        language: 'vi',
        title: 'Thuyết minh Dinh Độc Lập (Hội trường Thống Nhất)',
        narratorName: 'Lê Hương Giang',
        audioUrl: SAMPLE_AUDIO_URLS.vi,
        durationSeconds: 410,
        transcriptText: 'Dinh Độc Lập là chứng nhân lịch sử trọng đại của dân tộc Việt Nam. Được thiết kế bởi kiến trúc sư Ngô Viết Thụ, công trình mang triết lý phương Đông sâu sắc kết hợp với kiến trúc hiện đại thế kỷ 20...',
      },
      en: {
        language: 'en',
        title: 'Independence Palace Historic Tour',
        narratorName: 'David Miller',
        audioUrl: SAMPLE_AUDIO_URLS.en,
        durationSeconds: 395,
        transcriptText: 'The Independence Palace, also known as the Reunification Convention Hall, is a historic landmark designed by architect Ngo Viet Thu, blending modernist architecture with Eastern philosophical symbolism...',
      },
      ja: {
        language: 'ja',
        title: '統一会堂（旧大統領官邸）の解説',
        narratorName: '佐藤 健一',
        audioUrl: SAMPLE_AUDIO_URLS.ja,
        durationSeconds: 380,
        transcriptText: '統一会堂は、かつての南ベトナム大統領官邸であり、ベトナム戦争終結の舞台となった歴史的建造物です。東洋哲学の思想が取り入れられた建築美をご堪能ください...',
      },
      zh: {
        language: 'zh',
        title: '统一宫（独立宫）历史解说',
        narratorName: '李思颖',
        audioUrl: SAMPLE_AUDIO_URLS.zh,
        durationSeconds: 400,
        transcriptText: '统一宫曾是南越政权的总统府，是见证越南现代历史转折点的核心场所。建筑巧妙融合了东方传统哲理与现代主义设计风格...',
      },
    },
  },
  'audio-004': {
    id: 'audio-004',
    locationId: 'loc-004', // Chợ Bến Thành
    tracks: {
      vi: {
        language: 'vi',
        title: 'Thuyết minh Chợ Bến Thành - Trái tim thương mại Sài Gòn',
        narratorName: 'Trần Văn Minh',
        audioUrl: SAMPLE_AUDIO_URLS.vi,
        durationSeconds: 315,
        transcriptText: 'Chợ Bến Thành với tháp đồng hồ bốn mặt nổi tiếng đã trở thành biểu tượng giao thương nhộn nhịp bậc nhất của Thành phố Hồ Chí Minh qua hơn 100 năm lịch sử...',
      },
      en: {
        language: 'en',
        title: 'Ben Thanh Market Walking Guide',
        narratorName: 'Sarah Jenkins',
        audioUrl: SAMPLE_AUDIO_URLS.en,
        durationSeconds: 310,
        transcriptText: 'Ben Thanh Market is one of the oldest surviving landmarks in Ho Chi Minh City, famed for its iconic clock tower and lively stalls of handicrafts, textiles, and local street delicacies...',
      },
      ja: {
        language: 'ja',
        title: 'ベンタイン市場の散策ガイド',
        narratorName: '高橋 美咲',
        audioUrl: SAMPLE_AUDIO_URLS.ja,
        durationSeconds: 295,
        transcriptText: 'ベンタイン市場は100年以上の歴史を持つホーチミン市最大の伝統市場です。名物の時計塔をはじめ、活気あふれる雑貨店やベトナム名物グルメが揃っています...',
      },
      zh: {
        language: 'zh',
        title: '滨城市场游览指南',
        narratorName: '王凯',
        audioUrl: SAMPLE_AUDIO_URLS.zh,
        durationSeconds: 305,
        transcriptText: '滨城市场是胡志明市最著名、历史悠久的传统市场，拥有极具辨识度的四面大钟钟楼，汇集了琳琅满目的越南手工艺品、传统服饰和地道美食...',
      },
    },
  },
};
