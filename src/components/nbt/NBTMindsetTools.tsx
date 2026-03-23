import { motion } from 'framer-motion';
import { Brain, Heart, Clock, CheckCircle2, AlertCircle, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const NBTMindsetTools = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const studySchedule = [
    {
      day: 'Week 1-2',
      focus: 'Foundation & Diagnostics',
      activities: [
        'Take diagnostic test',
        'Identify weak areas',
        'Review basics in each section',
      ],
      hours: '10-12 hours',
    },
    {
      day: 'Week 3-6',
      focus: 'Intensive Learning',
      activities: [
        'Study 1-2 topics per week',
        'Complete practice questions',
        'Watch video lessons',
      ],
      hours: '15-18 hours',
    },
    {
      day: 'Week 7-8',
      focus: 'Full Practice Tests',
      activities: [
        'Take 2-3 full mock tests',
        'Review mistakes',
        'Focus on weak sections',
      ],
      hours: '12-15 hours',
    },
    {
      day: 'Final Week',
      focus: 'Review & Confidence',
      activities: [
        'Light review of key concepts',
        'Practice final questions',
        'Rest and mental prep',
      ],
      hours: '8-10 hours',
    },
  ];

  const stressManagement = [
    {
      title: 'Deep Breathing',
      duration: '5 minutes',
      description: 'Reduce anxiety with breathing exercises',
      instructions: [
        'Breathe in slowly for 4 counts',
        'Hold for 4 counts',
        'Exhale slowly for 4 counts',
        'Repeat 10 times',
      ],
    },
    {
      title: 'Progressive Relaxation',
      duration: '10 minutes',
      description: 'Release physical tension',
      instructions: [
        'Start with toes and tense for 5 seconds',
        'Release and notice the feeling',
        'Move up through your body',
        'End with face and head',
      ],
    },
    {
      title: 'Mindfulness Meditation',
      duration: '15 minutes',
      description: 'Calm your mind and improve focus',
      instructions: [
        'Find a quiet, comfortable place',
        'Focus on your breath',
        'Notice thoughts without judgment',
        'Return focus to breathing',
      ],
    },
    {
      title: 'Positive Visualization',
      duration: '10 minutes',
      description: 'Build confidence for test day',
      instructions: [
        'Close your eyes and relax',
        'Visualize yourself taking the test',
        'See yourself answering confidently',
        'Feel the success and relief',
      ],
    },
  ];

  const examChecklist = [
    'Get 8 hours of sleep the night before',
    'Eat a healthy breakfast on test day',
    'Bring all required documents',
    'Arrive 30 minutes early',
    'Read all instructions carefully',
    'Manage your time - don\'t get stuck on one question',
    'Answer easier questions first',
    'Review answers if time permits',
    'Stay calm and breathe during the test',
    'Don\'t panic if you don\'t know an answer',
  ];

  const timeManagementTips = [
    {
      tip: 'Use the Pomodoro Technique',
      detail: '25 min focus + 5 min break. After 4 cycles, take 15 min break',
    },
    {
      tip: 'Study in the morning when alert',
      detail: 'Peak mental performance is typically 8 AM - 12 PM',
    },
    {
      tip: 'Don\'t over-study the day before',
      detail: 'Review lightly, then rest to keep your mind fresh',
    },
    {
      tip: 'Take practice tests under timed conditions',
      detail: 'Get comfortable with pacing and time pressure',
    },
    {
      tip: 'Use active recall during practice',
      detail: 'Cover answers and try to remember, then check',
    },
    {
      tip: 'Track your improvements',
      detail: 'Monitor progress to stay motivated',
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 w-full"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-2 text-foreground">
              Stress Management & Exam Prep
            </h2>
            <p className="text-foreground/80">
              Mental strategies, study schedules, and stress relief tools for exam success.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="schedule" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="stress">Stress Relief</TabsTrigger>
          <TabsTrigger value="time">Time Mgmt</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
        </TabsList>

        {/* Study Schedule */}
        <TabsContent value="schedule" className="space-y-4 mt-6">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>8-Week Intensive Study Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {studySchedule.map((week, idx) => (
                  <div key={idx} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-foreground">{week.day}</h4>
                        <p className="text-sm text-primary font-medium">{week.focus}</p>
                      </div>
                      <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-medium">
                        {week.hours}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {week.activities.map((activity, i) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground/80">
                          <span className="text-primary">•</span>
                          {activity}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6">
                <h3 className="font-bold text-foreground mb-3">Total Study Hours: 45-55 hours</h3>
                <p className="text-sm text-foreground/80 mb-4">
                  This is an intensive program. Adjust based on your starting level and target score.
                </p>
                <Button className="w-full">Download Detailed Schedule</Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Stress Relief */}
        <TabsContent value="stress" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stressManagement.map((technique, idx) => (
              <Card key={idx} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-foreground">{technique.title}</h3>
                    <span className="px-2 py-1 bg-primary/20 text-primary rounded text-xs font-medium">
                      {technique.duration}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {technique.description}
                  </p>
                  <div className="bg-secondary/30 rounded-lg p-3 mb-4">
                    <ol className="space-y-2 text-xs text-foreground/80">
                      {technique.instructions.map((instruction, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-bold text-primary">{i + 1}.</span>
                          {instruction}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <Button size="sm" variant="outline" className="w-full">
                    Try Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-gradient-to-r from-green-500/10 to-green-500/5 border-green-500/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="w-5 h-5 text-green-600" />
                Self-Care During Exam Prep
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  '✓ Sleep 7-8 hours daily',
                  '✓ Exercise 30 min daily',
                  '✓ Eat balanced meals',
                  '✓ Limit caffeine & sugar',
                  '✓ Maintain social life',
                  '✓ Take short breaks',
                  '✓ Practice hobbies',
                  '✓ Stay hydrated',
                ].map((item, idx) => (
                  <p key={idx} className="text-sm text-foreground/80">
                    {item}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time Management */}
        <TabsContent value="time" className="space-y-4 mt-6">
          <div className="space-y-3">
            {timeManagementTips.map((item, idx) => (
              <Card key={idx} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-bold text-foreground mb-1">
                        {item.tip}
                      </h4>
                      <p className="text-sm text-foreground/80">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                During the Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm text-foreground/80">
                <p>
                  <strong>AQL (60 min):</strong> Allocate ~1 min per question, save 5 min for review
                </p>
                <p>
                  <strong>MAT (90 min):</strong> Pace yourself at ~2 min per question, complex problems get 3 min
                </p>
                <p>
                  <strong>AQL (60 min):</strong> Quick items 1 min, complex graphs 2-3 min, save review time
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exam Checklist */}
        <TabsContent value="checklist" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Exam Day Checklist
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {examChecklist.map((item, idx) => (
                  <label key={idx} className="flex items-start gap-3 p-3 hover:bg-secondary/30 rounded-lg cursor-pointer transition-colors group">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-border text-primary mt-1 cursor-pointer"
                    />
                    <span className="text-foreground group-hover:font-medium transition-all">
                      {item}
                    </span>
                  </label>
                ))}
              </div>
              <Button className="w-full mt-6">Print Checklist</Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                Common Exam Mistakes to Avoid
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-foreground/80">
              <p>✗ Not reading questions carefully</p>
              <p>✗ Spending too much time on difficult questions</p>
              <p>✗ Forgetting to show your work (where applicable)</p>
              <p>✗ Not checking your answers</p>
              <p>✗ Panicking when unsure - use elimination strategy</p>
              <p>✗ Leaving questions unanswered - guess intelligently</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mental Strategies */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Mental Strategies for Success
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-bold text-foreground">Growth Mindset</h4>
                <ul className="space-y-2 text-sm text-foreground/80">
                  <li>• Believe you can improve with effort</li>
                  <li>• View mistakes as learning opportunities</li>
                  <li>• Focus on progress, not perfection</li>
                  <li>• Celebrate small wins</li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-bold text-foreground">Building Confidence</h4>
                <ul className="space-y-2 text-sm text-foreground/80">
                  <li>• Track your improvements</li>
                  <li>• Remember your strengths</li>
                  <li>• Practice challenging questions</li>
                  <li>• Visualize success daily</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Resources */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-bold mb-2 text-foreground">Need Extra Support?</h3>
            <p className="text-foreground/80 mb-4">
              Access our complete wellness and mindset resources
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button variant="outline">Meditation Guide</Button>
              <Button>Motivational Videos</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default NBTMindsetTools;
