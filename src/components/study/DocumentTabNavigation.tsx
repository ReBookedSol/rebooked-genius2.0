import { Layers, Brain, FileText, Sparkles, ClipboardList } from 'lucide-react';

interface DocumentTabNavigationProps {
  activeTab: 'document' | 'content' | 'lessons' | 'flashcards' | 'quizzes' | 'exams';
  onTabChange: (tab: 'document' | 'content' | 'lessons' | 'flashcards' | 'quizzes' | 'exams') => void;
}

const DocumentTabNavigation: React.FC<DocumentTabNavigationProps> = ({
  activeTab,
  onTabChange,
}) => {
  const tabs = [
    {
      id: 'lessons' as const,
      label: 'Lessons',
      icon: Sparkles,
    },
    {
      id: 'flashcards' as const,
      label: 'Flashcards',
      icon: Layers,
    },
    {
      id: 'quizzes' as const,
      label: 'Quizzes',
      icon: Brain,
    },
    {
      id: 'exams' as const,
      label: 'Exams',
      icon: ClipboardList,
    },
    {
      id: 'document' as const,
      label: 'Document',
      icon: FileText,
    },
  ];

  return (
    <div className="border-b border-border bg-muted/30 w-full overflow-x-auto">
      <div className="flex items-center justify-center gap-0 w-full min-w-max">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center justify-center gap-1.5 px-3 md:px-6 py-3 md:py-4 transition-colors duration-200 relative border-b-3 text-xs md:text-sm font-semibold min-w-[60px] max-w-[120px] md:max-w-[180px] ${
                isActive
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-3.5 h-3.5 md:w-5 md:h-5 flex-shrink-0" />
              <span className="hidden sm:inline truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DocumentTabNavigation;
