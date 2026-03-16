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

/**
 * System prompt addition for the AI to enable study plan suggestions
 * This should be added to the AI context
 */
export const STUDY_PLAN_SYSTEM_PROMPT = `
When suggesting study plans, timetables, or reminders to the user, format them as JSON blocks between triple backticks.

For study plans, use this format:
\`\`\`json
{
  "type": "study_plan",
  "title": "Your Plan Title",
  "description": "Brief description of the plan",
  "sessions": [
    {
      "day": "Monday",
      "time": "14:00",
      "subject": "Subject Name",
      "duration": 60,
      "topic": "Optional specific topic"
    }
  ]
}
\`\`\`

For individual reminders, use:
\`\`\`json
{
  "type": "reminder",
  "title": "Reminder title",
  "dueDate": "2024-03-20",
  "priority": "high",
  "description": "Optional description"
}
\`\`\`

The user will see interactive buttons to add these directly to their calendar and reminders. Make sure to explain what you're suggesting in regular text before the JSON block.
`;
