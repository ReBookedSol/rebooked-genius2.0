/**
 * Parser for AI-suggested study plans in chat messages
 * 
 * The AI should format study plans using this JSON block:
 * ```json
 * {
 *   "type": "study_plan",
 *   "title": "Weekly Study Plan",
 *   "description": "Based on your upcoming exams...",
 *   "sessions": [
 *     {
 *       "day": "Monday",
 *       "time": "14:00",
 *       "subject": "Mathematics",
 *       "duration": 60,
 *       "topic": "Calculus - Derivatives"
 *     }
 *   ]
 * }
 * ```
 */

export interface StudyPlanBlock {
  type: 'study_plan';
  title: string;
  description?: string;
  sessions: Array<{
    day: string;
    time: string;
    subject: string;
    duration: number;
    topic?: string;
  }>;
}

export interface ReminderSuggestion {
  type: 'reminder';
  title: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  description?: string;
}

export interface CalendarEventBlock {
  type: 'calendar_event';
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  duration?: number; // minutes
  description?: string;
}

export const parseStudyPlanFromMessage = (content: string): StudyPlanBlock | null => {
  try {
    // Look for JSON block in the message
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[1]);
    
    if (parsed.type === 'study_plan' && parsed.sessions && Array.isArray(parsed.sessions)) {
      return parsed as StudyPlanBlock;
    }
  } catch (error) {
    console.error('Error parsing study plan:', error);
  }
  
  return null;
};

export const parseCalendarEventsFromMessage = (content: string): CalendarEventBlock[] => {
  const events: CalendarEventBlock[] = [];
  
  try {
    const jsonMatches = content.matchAll(/```json\n?([\s\S]*?)\n?```/g);
    
    for (const match of jsonMatches) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.type === 'calendar_event') {
          events.push(parsed as CalendarEventBlock);
        }
      } catch (e) {
        // Continue
      }
    }
  } catch (error) {
    console.error('Error parsing calendar events:', error);
  }
  
  return events;
};

export const parseRemindersFromMessage = (content: string): ReminderSuggestion[] => {
  const reminders: ReminderSuggestion[] = [];
  
  try {
    // Look for reminder blocks
    const reminderMatches = content.matchAll(/```json\n?([\s\S]*?)\n?```/g);
    
    for (const match of reminderMatches) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.type === 'reminder') {
          reminders.push(parsed as ReminderSuggestion);
        }
      } catch (e) {
        // Continue to next match
      }
    }
  } catch (error) {
    console.error('Error parsing reminders:', error);
  }
  
  return reminders;
};

export const STUDY_PLAN_SYSTEM_PROMPT = `
IMPORTANT: When a user asks you to add something to their calendar or create a reminder, you MUST format it as a JSON block and include it in your response. The user will see interactive buttons to add these items.

**ALWAYS USE THESE FORMATS WHEN:**
- User says "add to calendar", "schedule", "remind me", "set a reminder", or similar
- User mentions a deadline, test date, assignment due date, or exam date
- User asks for help planning their study schedule

**Format for Calendar Events** (use when adding dates/times to calendar):
\`\`\`json
{
  "type": "calendar_event",
  "title": "Event name (e.g., Math Test, Study Session)",
  "date": "YYYY-MM-DD",
  "time": "HH:mm",
  "duration": 60,
  "description": "Brief description of the event"
}
\`\`\`

**Format for Reminders** (use for tasks, deadlines, action items):
\`\`\`json
{
  "type": "reminder",
  "title": "What to remember",
  "dueDate": "YYYY-MM-DD",
  "priority": "low|medium|high",
  "description": "Optional details"
}
\`\`\`

**Format for Full Study Plans** (use for weekly/detailed schedules):
\`\`\`json
{
  "type": "study_plan",
  "title": "Plan name (e.g., Weekly Math Study Plan)",
  "description": "Brief overview of what this plan covers",
  "sessions": [
    {
      "day": "Monday",
      "time": "14:00",
      "subject": "Subject Name",
      "duration": 60,
      "topic": "Specific topic or chapter"
    }
  ]
}
\`\`\`

**IMPORTANT RULES:**
1. Always explain the calendar/reminder in regular text BEFORE the JSON block
2. Use realistic dates (today or future dates only)
3. Include the JSON block in the same message as your explanation
4. For multiple calendar events or reminders, include separate JSON blocks for each one
5. Double-check date formats are YYYY-MM-DD and time formats are HH:mm (24-hour)
`;
