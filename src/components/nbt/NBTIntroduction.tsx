import { motion } from 'framer-motion';
import { BookOpen, Target, Zap, BarChart3, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';

const NBTIntroduction = () => {
  const { t } = useTranslation();

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

  const sections = [
    {
      title: t('nbt.whatIsNbt'),
      description: t('nbt.whatIsNbtDesc'),
      icon: Target,
      color: 'from-primary/10 to-primary/5',
    },
    {
      title: t('nbt.aqlTitle'),
      description: t('nbt.aqlDesc'),
      icon: BookOpen,
      color: 'from-accent-mint/30 to-accent-mint/10',
    },
    {
      title: t('nbt.matTitle'),
      description: t('nbt.matDesc'),
      icon: BarChart3,
      color: 'from-accent-lavender/30 to-accent-lavender/10',
    },
    {
      title: t('nbt.qlTitle'),
      description: t('nbt.qlDesc'),
      icon: Zap,
      color: 'from-amber-500/10 to-amber-500/5',
    },
  ];

  const scoringInfo = [
    {
      items: [
        '68 - 100%: Proficient (Ready for university study)',
        '38 - 67%: Intermediate (May require academic support)',
        '0 - 37%: Basic (Requires extensive academic support)',
      ],
    },
    {
      title: t('nbt.universityAdmission'),
      items: [
        'Different universities have different NBT requirements',
        'Some programs require minimum scores in specific sections',
        'NBT + Matric marks determine final admission decision',
        'Some universities offer academic development programs based on NBT scores',
        'Higher scores improve chances of competitive program admission',
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
      {/* Introduction */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold mb-4 text-foreground">
              {t('nbt.understandingNbt')}
            </h2>
            <p className="text-foreground/80 mb-4">
              {t('nbt.understandingNbtDesc')}
            </p>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
              <p className="text-sm text-foreground/70">
                <strong>{t('nbt.whyItMatters')}</strong> {t('nbt.whyItMattersDesc')}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <motion.div key={section.title} variants={itemVariants}>
              <Card className={`bg-gradient-to-br ${section.color}`}>
                <CardContent className="p-6">
                  <Icon className="w-8 h-8 mb-3 text-primary" />
                  <h3 className="text-xl font-bold mb-2 text-foreground">
                    {section.title}
                  </h3>
                  <p className="text-foreground/80 text-sm">
                    {section.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Scoring & Admission */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {scoringInfo.map((info) => (
          <motion.div key={info.title} variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  {info.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {info.items.map((item, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-foreground/80 text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Test Format */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {t('nbt.testFormatDuration')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-primary/5 p-4 rounded-lg">
                <h4 className="font-bold text-foreground mb-2">{t('nbt.aqlSection')}</h4>
                <p className="text-sm text-foreground/80 mb-2">{t('nbt.aqlSectionDesc')}</p>
                <p className="text-sm font-medium text-primary">60 {t('nbt.minutes')}</p>
              </div>
              <div className="bg-primary/5 p-4 rounded-lg">
                <h4 className="font-bold text-foreground mb-2">{t('nbt.matSection')}</h4>
                <p className="text-sm text-foreground/80 mb-2">{t('nbt.matSectionDesc')}</p>
                <p className="text-sm font-medium text-primary">90 {t('nbt.minutes')}</p>
              </div>
              <div className="bg-primary/5 p-4 rounded-lg">
                <h4 className="font-bold text-foreground mb-2">{t('nbt.qlSection')}</h4>
                <p className="text-sm text-foreground/80 mb-2">{t('nbt.qlSectionDesc')}</p>
                <p className="text-sm font-medium text-primary">60 {t('nbt.minutes')}</p>
              </div>
            </div>
            <p className="text-sm text-foreground/70 mt-4">
              <strong>{t('nbt.totalDuration')}</strong> {t('nbt.totalDurationDesc')}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* CTA */}
      <motion.div variants={itemVariants}>
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-6 text-center">
          <h3 className="text-xl font-bold mb-2 text-foreground">{t('nbt.readyToStart')}</h3>
          <p className="text-foreground/80 mb-4">
            {t('nbt.readyToStartDesc')}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button variant="default">{t('nbt.browseStudyMaterials')}</Button>
            <Button variant="outline">{t('nbt.takeDiagnosticTest')}</Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default NBTIntroduction;
