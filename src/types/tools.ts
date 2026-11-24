export type RouteView =
  | { page: 'home'; anchor?: 'premium' | 'free' }
  | { page: 'pdf' }
  | { page: 'pdf-tool'; toolId: string }
  | { page: 'card-crop'; cardTypeId?: string }
  | { page: 'image-tools'; mode?: ImageToolMode }
  | { page: 'photo-signature' }
  | { page: 'passport-photo' }
  | { page: 'doc-maker'; docType: DocMakerType }
  | { page: 'blog' }
  | { page: 'blog-post'; postId: string }
  | { page: 'contact' };

export type ToolGroup = 'premium' | 'free' | 'pdf';

export type ImageToolMode =
  | 'resize'
  | 'compress'
  | 'crop'
  | 'convert'
  | 'card-crop'
  | 'straighten'
  | 'bg-studio'
  | 'exam-photo';

export type DocMakerType =
  | 'invoice'
  | 'salary-slip'
  | 'application'
  | 'visiting-card'
  | 'resume';

export interface ToolItem {
  id: string;
  group: ToolGroup;
  title: string;
  subtitle: string;
  icon: string;
  gradient?: string;
  accentColor?: string;
  isNew?: boolean;
  ribbonText?: string;
  pdfCategory?: 'Organize' | 'Convert' | 'Edit' | 'Optimize';
  route: RouteView;
  keywords: string[];
}

export interface BlogStep {
  heading: string;
  body: string;
  highlight?: {
    title: string;
    body: string;
  };
}

export interface BlogPost {
  id: string;
  title: string;
  category: string;
  date: string;
  readTime: string;
  views: number;
  thumbColor: string;
  excerpt: string;
  steps: BlogStep[];
}
