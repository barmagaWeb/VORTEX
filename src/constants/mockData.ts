import { User, Post, Community, Conversation, NotificationItem, Report, AuditLog } from '../types';

export const CURRENT_USER: User = {
  id: 'usr_me',
  name: 'Ahmed Mohamed',
  username: 'ahmedmohamed',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  coverImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80',
  bio: '🚀 مطور ويب ومحب للتكنولوجيا | Senior Web Engineer & Creative Builder. Exploring the universe of modern frontends.',
  location: 'Cairo, Egypt / Remote',
  website: 'https://ahmedmohamed.dev',
  verified: true,
  followersCount: 12500,
  followingCount: 136,
  postsCount: 245,
  joinedDate: 'March 2024',
  isFollowing: false,
  role: 'user',
};

export const ADMIN_USER: User = {
  id: 'usr_admin',
  name: 'Elena Rostova',
  username: 'elena_admin',
  avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
  coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
  bio: 'Platform Lead & Trust & Safety Architect at VORTEX. Ensuring a clean, safe, and vibrant social ecosystem.',
  location: 'Zurich, Switzerland',
  website: 'https://vortex.social/security',
  verified: true,
  followersCount: 45800,
  followingCount: 42,
  postsCount: 112,
  joinedDate: 'January 2024',
  role: 'admin',
};

export const MOCK_USERS: User[] = [
  CURRENT_USER,
  ADMIN_USER,
  {
    id: 'usr_sara',
    name: 'Sara Ahmed',
    username: 'sara_ahmed',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80',
    bio: 'Product Designer & 3D Visual Artist. Obsessed with micro-interactions, dark interfaces, and typography. ✨',
    location: 'Dubai, UAE',
    website: 'https://sara-design.studio',
    verified: true,
    followersCount: 28400,
    followingCount: 310,
    postsCount: 382,
    joinedDate: 'February 2024',
    isFollowing: true,
    role: 'user',
  },
  {
    id: 'usr_mohamed',
    name: 'Mohamed Ali',
    username: 'mohamed_ali',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    coverImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80',
    bio: 'Cloud Architect & AI Researcher. Building scalable distributed systems. Coffee enthusiast ☕',
    location: 'Riyadh, Saudi Arabia',
    website: 'https://m-ali.cloud',
    verified: true,
    followersCount: 19800,
    followingCount: 180,
    postsCount: 167,
    joinedDate: 'April 2024',
    isFollowing: true,
    role: 'user',
  },
  {
    id: 'usr_layla',
    name: 'Layla Hassan',
    username: 'laylahassan',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    coverImage: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=80',
    bio: 'Visual Storyteller & National Geographic contributor. Capturing raw landscapes across the globe 📷🏔️',
    location: 'Amman, Jordan',
    website: 'https://laylahassan.photos',
    verified: true,
    followersCount: 42100,
    followingCount: 215,
    postsCount: 520,
    joinedDate: 'January 2024',
    isFollowing: false,
    role: 'user',
  },
  {
    id: 'usr_marcus',
    name: 'Marcus Chen',
    username: 'marcuschen',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    coverImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80',
    bio: 'Design Systems Architect at Lattice. Obsessed with accessible tokens, WCAG 2.2, and clean frontend code.',
    location: 'Singapore',
    website: 'https://marcuschen.io',
    verified: true,
    followersCount: 16200,
    followingCount: 95,
    postsCount: 140,
    joinedDate: 'May 2024',
    isFollowing: false,
    role: 'user',
  },
  {
    id: 'usr_noor',
    name: 'Noor Al-Zahra',
    username: 'nooralzahra',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    coverImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1600&q=80',
    bio: 'Digital Illustrator & Concept Artist. Transforming Arabic mythology into futuristic cyberpunk universes 🪐',
    location: 'Baghdad, Iraq',
    website: 'https://artstation.com/noor_z',
    verified: false,
    followersCount: 8900,
    followingCount: 240,
    postsCount: 188,
    joinedDate: 'June 2024',
    isFollowing: false,
    role: 'user',
  }
];

export const MOCK_COMMUNITIES: Community[] = [
  {
    id: 'comm_webdev',
    name: 'Frontend Engineers',
    slug: 'frontend-engineers',
    description: 'The premier community for React, TypeScript, performance optimizations, CSS architecture, and web standards.',
    avatar: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=300&q=80',
    coverImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
    memberCount: 48200,
    isMember: true,
    category: 'Technology',
    rules: [
      'Be respectful and construct constructive critiques.',
      'Provide code snippets or sandbox links when asking for help.',
      'No self-promotional spam or commercial job postings without prior mod approval.'
    ],
    moderators: [CURRENT_USER, ADMIN_USER],
    createdAt: '2024-01-15'
  },
  {
    id: 'comm_arabic_design',
    name: 'Arabic Typography & Design',
    slug: 'arabic-typography',
    description: 'مجتمع متخصص في الخط العربي الحديث، وتصميم واجهات المستخدم ثنائية اللغة، وجماليات الحرف العربي الرقمي.',
    avatar: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=300&q=80',
    coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    memberCount: 23600,
    isMember: true,
    category: 'Design & Art',
    rules: [
      'احترام الملكية الفكرية وذكر أسماء الخطاطين والمصممين.',
      'المشاركة البناءة ونقد الأعمال باحترافية.',
      'التركيز على فنون الخط والطباعة والواجهات العربية.'
    ],
    moderators: [MOCK_USERS[2]],
    createdAt: '2024-02-01'
  },
  {
    id: 'comm_photography',
    name: 'World Photography Hub',
    slug: 'world-photography',
    description: 'Showcasing the world through breathtaking lenses. Golden hours, architectural wonders, street life, and astrophotography.',
    avatar: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=300&q=80',
    coverImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    memberCount: 37400,
    isMember: false,
    category: 'Photography',
    rules: [
      'Include camera gear and EXIF metadata when possible.',
      'Only original photography allowed.',
      'Critiques must focus on lighting, composition, and technique.'
    ],
    moderators: [MOCK_USERS[4]],
    createdAt: '2024-02-20'
  },
  {
    id: 'comm_ai',
    name: 'AI & Machine Intelligence',
    slug: 'ai-intelligence',
    description: 'Discussions on neural architectures, large models, edge inference, generative media, and the societal impact of AI.',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80',
    coverImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    memberCount: 61900,
    isMember: false,
    category: 'Science & Future',
    rules: [
      'Link directly to papers, arXiv preprints, or official releases.',
      'No low-effort hype or unverified claims.',
      'Ethical AI discussion is encouraged.'
    ],
    moderators: [MOCK_USERS[3]],
    createdAt: '2024-01-10'
  }
];

export const MOCK_POSTS: Post[] = [
  {
    id: 'post_1',
    author: CURRENT_USER,
    content: 'أحب هذا المكان فعلاً! ❤️ تم التقاط هذه اللحظة الساحرة أثناء الغروب بين ناطحات السحاب. التوازن بين الإضاءة الطبيعية وأضواء المدينة يصنع لوحة لا تتكرر.',
    images: [
      'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1600&q=80'
    ],
    feeling: '✨ feeling inspired',
    createdAt: '2 hours ago',
    likesCount: 1240,
    commentsCount: 247,
    repostsCount: 89,
    sharesCount: 54,
    isLiked: true,
    isReposted: false,
    isBookmarked: true,
    tags: ['cityscape', 'sunset', 'photography', 'vortex'],
    visibility: 'public'
  },
  {
    id: 'post_2',
    author: MOCK_USERS[2], // Sara Ahmed
    content: 'Unveiling our spatial dark interface exploration for VORTEX! 🔮 We focused on restrained violet-electric gradients, fine 1px borders, and pure accessibility across high-contrast monitors. Feedback is welcome!',
    images: [
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1400&q=80'
    ],
    feeling: '🎨 feeling creative',
    createdAt: '4 hours ago',
    likesCount: 892,
    commentsCount: 64,
    repostsCount: 41,
    sharesCount: 19,
    isLiked: false,
    isReposted: true,
    isBookmarked: false,
    tags: ['uiux', 'designsystems', 'darkmode', 'webdesign'],
    visibility: 'public'
  },
  {
    id: 'post_3',
    author: MOCK_USERS[3], // Mohamed Ali
    content: 'WebGPU brings raw hardware shader power directly to browsers. In this benchmark, running local vector embeddings on the client reduced cloud inference latency by 85% while preserving total user privacy. The client-first web architecture is here.',
    createdAt: '6 hours ago',
    likesCount: 524,
    commentsCount: 38,
    repostsCount: 72,
    sharesCount: 33,
    isLiked: false,
    isReposted: false,
    isBookmarked: false,
    communityId: 'comm_webdev',
    communityName: 'Frontend Engineers',
    tags: ['webgpu', 'typescript', 'architecture', 'performance'],
    visibility: 'public'
  },
  {
    id: 'post_4',
    author: MOCK_USERS[4], // Layla Hassan
    content: 'من رحلتي الأخيرة إلى المرتفعات الجبلية 🏔️ الضباب يغلف القمم مع بزوغ أول خيوط الشمس. الطبيعة تعلمنا دائماً الصبر والاتزان.',
    images: [
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=80'
    ],
    feeling: '🏔️ feeling peaceful',
    createdAt: '1 day ago',
    likesCount: 2140,
    commentsCount: 185,
    repostsCount: 110,
    sharesCount: 88,
    isLiked: true,
    isReposted: false,
    isBookmarked: true,
    communityId: 'comm_photography',
    communityName: 'World Photography Hub',
    tags: ['mountains', 'nature', 'travelphotography', 'peace'],
    visibility: 'public'
  },
  {
    id: 'post_5',
    author: MOCK_USERS[5], // Marcus Chen
    content: 'Reminder for frontend engineers: Design tokens are not just CSS variables. They are a contract between design decisions and engineering execution. When naming tokens, express intent rather than direct visual values (e.g., surface-elevated vs bg-gray-900).',
    createdAt: '1 day ago',
    likesCount: 673,
    commentsCount: 42,
    repostsCount: 95,
    sharesCount: 29,
    isLiked: false,
    isReposted: false,
    isBookmarked: false,
    tags: ['designtokens', 'css', 'designsystems'],
    visibility: 'public'
  }
];

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv_sara',
    participant: MOCK_USERS[2], // Sara Ahmed
    lastMessage: {
      id: 'msg_2',
      senderId: 'usr_me',
      conversationId: 'conv_sara',
      content: 'بخير، شكراً 😊 التصميم الجديد للواجهة رائع جداً!',
      createdAt: '10:26 AM',
      isRead: true
    },
    unreadCount: 0,
    isOnline: true,
    isTyping: false
  },
  {
    id: 'conv_mohamed',
    participant: MOCK_USERS[3], // Mohamed Ali
    lastMessage: {
      id: 'msg_3',
      senderId: 'usr_mohamed',
      conversationId: 'conv_mohamed',
      content: 'هل اطلعت على تجربة تشغيل WebGPU الأخيرة؟ النتائج مذهلة.',
      createdAt: '5m ago',
      isRead: false
    },
    unreadCount: 2,
    isOnline: true,
    isTyping: true
  },
  {
    id: 'conv_group_tech',
    participant: {
      ...CURRENT_USER,
      name: 'Tech Community Group',
      username: 'tech_group',
      avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=300&q=80',
    },
    lastMessage: {
      id: 'msg_4',
      senderId: 'usr_sara',
      conversationId: 'conv_group_tech',
      content: 'Layla: We are hosting the live demo tomorrow!',
      createdAt: '10m ago',
      isRead: true
    },
    unreadCount: 0,
    isOnline: true,
    isGroup: true,
    groupName: 'Tech Community (12 members)'
  },
  {
    id: 'conv_layla',
    participant: MOCK_USERS[4], // Layla Hassan
    lastMessage: {
      id: 'msg_5',
      senderId: 'usr_layla',
      conversationId: 'conv_layla',
      content: 'سأرسل لك الألبوم عالي الدقة قريباً 📷',
      createdAt: '1h ago',
      isRead: true
    },
    unreadCount: 0,
    isOnline: false
  }
];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_1',
    type: 'like',
    actor: MOCK_USERS[2], // Sara
    postId: 'post_1',
    postSnippet: 'أحب هذا المكان فعلاً! ❤️ تم التقاط هذه اللحظة الساحرة...',
    createdAt: '12m ago',
    isRead: false
  },
  {
    id: 'notif_2',
    type: 'comment',
    actor: MOCK_USERS[3], // Mohamed Ali
    postId: 'post_1',
    postSnippet: 'Fantastic composition! The lighting balance is superb.',
    createdAt: '45m ago',
    isRead: false
  },
  {
    id: 'notif_3',
    type: 'follow',
    actor: MOCK_USERS[4], // Layla
    createdAt: '2h ago',
    isRead: false
  },
  {
    id: 'notif_4',
    type: 'repost',
    actor: MOCK_USERS[5], // Marcus
    postId: 'post_1',
    postSnippet: 'أحب هذا المكان فعلاً! ❤️...',
    createdAt: '5h ago',
    isRead: true
  },
  {
    id: 'notif_5',
    type: 'community',
    actor: CURRENT_USER,
    postSnippet: 'Your post was featured in Frontend Engineers highlights!',
    createdAt: '1d ago',
    isRead: true
  },
  {
    id: 'notif_6',
    type: 'reply',
    actor: MOCK_USERS[2],
    postId: 'post_1',
    commentId: 'comment_reply_1',
    postSnippet: 'Thanks for sharing the details!',
    createdAt: '2d ago',
    isRead: true
  },
  {
    id: 'notif_7',
    type: 'message',
    actor: MOCK_USERS[3],
    conversationId: 'conv_1',
    messageId: 'message_1',
    postSnippet: 'Are you free to review the design today?',
    createdAt: '3d ago',
    isRead: true
  }
];

export const MOCK_REPORTS: Report[] = [
  {
    id: 'rep_1',
    reportedItemType: 'post',
    reportedItemId: 'post_spam_99',
    reportedItemSnippet: '🔥 Guaranteed 500% profit in 24 hours! Click bit.ly/crypto-scam to claim...',
    reportedByUser: MOCK_USERS[2],
    reason: 'Spam / Scam Solicitation',
    details: 'Spam link bot posting across multiple hashtags.',
    status: 'pending',
    createdAt: '15m ago'
  },
  {
    id: 'rep_2',
    reportedItemType: 'user',
    reportedItemId: 'usr_toxic_3',
    reportedItemSnippet: '@impersonator_vip: Unofficial clone pretending to be VORTEX Official Staff',
    reportedByUser: MOCK_USERS[3],
    reason: 'Impersonation / Fraud',
    details: 'Copied platform logos and attempting to phish user credentials in DMs.',
    status: 'pending',
    createdAt: '1h ago'
  },
  {
    id: 'rep_3',
    reportedItemType: 'comment',
    reportedItemId: 'com_harass_12',
    reportedItemSnippet: 'Aggressive personal attack targeting author...',
    reportedByUser: MOCK_USERS[4],
    reason: 'Harassment & Hate Speech',
    details: 'Violates community guidelines under rule 1.',
    status: 'reviewed',
    createdAt: '3h ago'
  }
];

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'audit_1',
    adminName: 'Elena Rostova',
    action: 'Suspended Account',
    target: '@spambot_3042',
    timestamp: '10m ago',
    status: 'danger'
  },
  {
    id: 'audit_2',
    adminName: 'Elena Rostova',
    action: 'Verified Badge Granted',
    target: '@sara_ahmed',
    timestamp: '2h ago',
    status: 'success'
  },
  {
    id: 'audit_3',
    adminName: 'Elena Rostova',
    action: 'Post Removed (TOS Violation)',
    target: 'post_id_98213',
    timestamp: '4h ago',
    status: 'warning'
  },
  {
    id: 'audit_4',
    adminName: 'System Automated Sentinel',
    action: 'Rate Limiting Engaged',
    target: 'IP Pool 185.220.x.x',
    timestamp: '8h ago',
    status: 'warning'
  }
];
