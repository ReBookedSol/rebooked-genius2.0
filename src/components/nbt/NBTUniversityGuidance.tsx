import { motion } from 'framer-motion';
import { Zap, BarChart3, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const NBTUniversityGuidance = () => {
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

  const universities = [
    {
      name: 'University of Cape Town (UCT)',
      aqlMin: 65,
      matMin: 70,
      focus: 'Commerce, Science, Engineering',
      programs: 'All programs require NBT',
    },
    {
      name: 'Wits University',
      aqlMin: 60,
      matMin: 65,
      focus: 'Commerce, Engineering, Medicine',
      programs: 'Most programs require NBT',
    },
    {
      name: 'Stellenbosch University',
      aqlMin: 65,
      matMin: 68,
      focus: 'Engineering, Business, Science',
      programs: 'Competitive programs require high scores',
    },
    {
      name: 'University of Johannesburg (UJ)',
      aqlMin: 55,
      matMin: 60,
      focus: 'Engineering, Commerce, Science',
      programs: 'All programs welcome applicants with NBT',
    },
    {
      name: 'Rhodes University',
      aqlMin: 68,
      matMin: 70,
      focus: 'Humanities, Science, Commerce',
      programs: 'Strong NBT scores enhance applications',
    },
    {
      name: 'University of KwaZulu-Natal (UKZN)',
      aqlMin: 60,
      matMin: 62,
      focus: 'Medicine, Law, Engineering',
      programs: 'Recommended for all programs',
    },
  ];

  const programs = [
    {
      category: 'Engineering Programs',
      programs: [
        'Mechanical Engineering - MAT 75+, AQL 65+',
        'Chemical Engineering - MAT 78+, AQL 70+',
        'Civil Engineering - MAT 72+, AQL 62+',
      ],
    },
    {
      category: 'Commerce & Business',
      programs: [
        'BCom - AQL 65+',
        'Accounting - AQL 70+, MAT 70+',
        'MBA Prerequisites - AQL 70+',
      ],
    },
    {
      category: 'Health Sciences',
      programs: [
        'Medicine - AQL 75+, MAT 80+',
        'Nursing - AQL 65+, MAT 65+',
        'Pharmacy - AQL 70+, MAT 75+',
      ],
    },
    {
      category: 'Humanities & Law',
      programs: [
        'Law - AQL 75+',
        'Psychology - AQL 70+, MAT 60+',
        'Education - AQL 68+',
      ],
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
              University Guidance
            </h2>
            <p className="text-foreground/80">
              Explore university requirements, minimum scores, and program-specific guidance.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Tabs */}
      <Tabs defaultValue="universities" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="universities">Universities</TabsTrigger>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="calculator">Score Interpretation</TabsTrigger>
        </TabsList>

        {/* Universities Tab */}
        <TabsContent value="universities" className="space-y-4 mt-6">
          <div className="space-y-3">
            {universities.map((uni) => (
              <Card key={uni.name} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg text-foreground mb-3">{uni.name}</h3>
                  
                  <div className="flex gap-4 mb-4">
                    <div className="bg-primary/5 p-3 rounded-lg flex-1 text-center">
                      <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">AQL Min</p>
                      <p className="text-2xl font-black text-primary">{uni.aqlMin}</p>
                    </div>
                    <div className="bg-primary/5 p-3 rounded-lg flex-1 text-center">
                      <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">MAT Min</p>
                      <p className="text-2xl font-black text-secondary">{uni.matMin}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <p className="text-foreground/80">
                      <strong>Focus Areas:</strong> {uni.focus}
                    </p>
                    <p className="text-foreground/80">
                      <strong>Requirements:</strong> {uni.programs}
                    </p>
                  </div>

                  <Button size="sm" variant="outline" className="w-full">
                    View Programs
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Programs Tab */}
        <TabsContent value="programs" className="space-y-4 mt-6">
          <div className="space-y-4">
            {programs.map((prog) => (
              <Card key={prog.category}>
                <CardHeader>
                  <CardTitle className="text-base">{prog.category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {prog.programs.map((program, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
                        <Target className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                        <span className="text-sm text-foreground/80">{program}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Score Guide Tab */}
        <TabsContent value="calculator" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Score Interpretation Guide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  range: '81-100',
                  label: 'Excellent',
                  color: 'from-green-500/20 to-green-500/5',
                  desc: 'Competitive for top-tier programs at most universities',
                },
                {
                  range: '71-80',
                  label: 'Good',
                  color: 'from-blue-500/20 to-blue-500/5',
                  desc: 'Suitable for most degree programs',
                },
                {
                  range: '51-70',
                  label: 'Average',
                  color: 'from-amber-500/20 to-amber-500/5',
                  desc: 'May qualify for extended/academic development programs',
                },
                {
                  range: '31-50',
                  label: 'Below Average',
                  color: 'from-orange-500/20 to-orange-500/5',
                  desc: 'Consider academic support or retaking the test',
                },
              ].map((score) => (
                <div
                  key={score.range}
                  className={`bg-gradient-to-r ${score.color} border border-primary/10 p-4 rounded-lg`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-foreground">{score.range}</h4>
                    <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-xs font-medium">
                      {score.label}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80">{score.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Admission Calculator
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/80 mb-4">
                Your final admission score combines:
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                  <span className="text-foreground">Matric Average (60%)</span>
                  <span className="font-bold text-primary">60%</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                  <span className="text-foreground">NBT Score (40%)</span>
                  <span className="font-bold text-primary">40%</span>
                </div>
                <div className="border-t border-border pt-3 mt-3">
                  <p className="text-sm text-foreground/80 mb-3">
                    Example: Matric 75% + NBT 70%
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    Final Score: {((75 * 0.6) + (70 * 0.4)).toFixed(1)}%
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-4">
                Note: Some universities have different weightings. Check your university for specifics.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tips for Success */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Tips for Strong University Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium text-foreground">✓ Aim High</h4>
                <ul className="text-sm text-foreground/80 space-y-2">
                  <li>• Target scores above university minimums</li>
                  <li>• Competitive programs need 75%+</li>
                  <li>• Research your preferred program's needs</li>
                  <li>• Consider retaking if below requirements</li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-medium text-foreground">📋 Application Strategy</h4>
                <ul className="text-sm text-foreground/80 space-y-2">
                  <li>• Apply to 2-3 universities</li>
                  <li>• Mix safety, target, and reach programs</li>
                  <li>• Highlight diverse skills in essays</li>
                  <li>• Meet all deadlines early</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default NBTUniversityGuidance;
