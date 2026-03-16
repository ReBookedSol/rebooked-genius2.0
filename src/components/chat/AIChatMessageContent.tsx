import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { parseStudyPlanFromMessage, parseRemindersFromMessage, parseCalendarEventsFromMessage } from '@/lib/aiStudyPlanParser';
import AIStudyPlanSuggestion from './AIStudyPlanSuggestion';
import AIChatReminder from './AIChatReminder';
import AICalendarEvent from './AICalendarEvent';

interface AIChatMessageContentProps {
  content: string;
}

/**
 * Component that parses and renders AI chat messages with interactive suggestions
 * Supports:
 * - Regular markdown messages
 * - Study plan suggestions (renders AIStudyPlanSuggestion component)
 * - Reminder suggestions (renders AIChatReminder component)
 */
export const AIChatMessageContent: React.FC<AIChatMessageContentProps> = ({ content }) => {
  // Parse for study plan suggestion
  const studyPlan = parseStudyPlanFromMessage(content);
  
  // Parse for calendar events
  const calendarEvents = parseCalendarEventsFromMessage(content);
  
  // Parse for reminder suggestions
  const reminders = parseRemindersFromMessage(content);

  // Remove JSON blocks from displayed content
  const displayContent = content
    .replace(/```json\n?([\s\S]*?)\n?```/g, '')
    .trim();

  return (
    <div className="space-y-3">
      {/* Main message content */}
      {displayContent && (
        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {displayContent}
          </ReactMarkdown>
        </div>
      )}

      {/* Study Plan Suggestion */}
      {studyPlan && (
        <AIStudyPlanSuggestion
          plan={studyPlan.sessions}
          title={studyPlan.title}
          description={studyPlan.description}
        />
      )}

      {/* Calendar Events */}
      {calendarEvents.length > 0 && (
        <div className="space-y-2 mt-2">
          {calendarEvents.map((event, idx) => (
            <AICalendarEvent key={idx} event={event} />
          ))}
        </div>
      )}

      {/* Reminder Suggestions */}
      {reminders.length > 0 && (
        <div className="space-y-2 mt-2">
          {reminders.map((reminder, idx) => (
            <AIChatReminder
              key={idx}
              suggestion={{
                title: reminder.title,
                dueDate: reminder.dueDate ? new Date(reminder.dueDate) : undefined,
                type: undefined,
                description: reminder.description,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AIChatMessageContent;
