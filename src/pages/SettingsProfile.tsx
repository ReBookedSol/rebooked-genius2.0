import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Lock,
  Phone,
  BookOpen,
  Globe,
  Loader2,
  Check,
  Eye,
  EyeOff,
  Save,
  Palette,
  Zap,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { useAIContext } from '@/contexts/AIContext';
import { useTranslation } from '@/hooks/use-translation';
import { usePageAnimation } from '@/hooks/use-page-animation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAnimationContext } from '@/contexts/AnimationContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/layout/AppLayout';
import SettingsSidebar from '@/components/layout/SettingsSidebar';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getSubjectsByCurriculumAndGrade, type Curriculum } from '@/data/curricula';

const SettingsProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setAiContext } = useAIContext();
  const { t } = useTranslation();
  const { shouldAnimate } = usePageAnimation('SettingsProfile');
  const { language: appLanguage, setLanguage: setAppLanguage } = useLanguage();
  const { animationsEnabled, setAnimationsEnabled } = useAnimationContext();

  // Profile state
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState('12');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [examBoard, setExamBoard] = useState('CAPS');
  const [language, setLanguage] = useState<'en' | 'af'>('en');

  // Password state
  const [showPasswords, setShowPasswords] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Animation preference state
  const [savingAnimationPreference, setSavingAnimationPreference] = useState(false);

  // Get subjects list dynamically based on selected curriculum and grade
  const getCurriculumKey = (examBoard: string): Curriculum => {
    const mapping: Record<string, Curriculum> = {
      'CAPS': 'caps',
      'IEB': 'ieb',
      'Cambridge': 'cambridge',
    };
    return mapping[examBoard] || 'caps';
  };

  const availableSubjects = useMemo(() => {
    const curriculumKey = getCurriculumKey(examBoard);
    const gradeKey = grade as any;
    return getSubjectsByCurriculumAndGrade(curriculumKey, gradeKey);
  }, [examBoard, grade]);

  useEffect(() => {
    setAiContext({
      currentPage: 'settings',
      location: 'User Profile & Preferences',
      activeAnalytics: null,
      activeDocument: null,
      activePaper: null
    });
  }, [setAiContext]);

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || '');
      fetchProfile();
    }
  }, [user]);

  // Initialize language from app language
  useEffect(() => {
    setLanguage(appLanguage);
  }, []);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
    if (data) {
      setFullName(data.full_name || '');
      setGrade(data.grade?.toString() || '12');
      // Ensure subjects is always an array
      const subjectsData = data.subjects;
      const parsedSubjects = Array.isArray(subjectsData) ? subjectsData :
                            (typeof subjectsData === 'string' ? JSON.parse(subjectsData) : []);
      setSubjects(parsedSubjects);
      setExamBoard(data.exam_board || 'CAPS');
      const savedLanguage = (data.language as 'en' | 'af') || 'en';
      setAppLanguage(savedLanguage);
    }
  };

  const handleSaveProfile = async () => {
    if (subjects.length === 0) {
      toast({
        title: t('settings.error'),
        description: 'Please select at least one subject',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: fullName,
        grade: parseInt(grade),
        subjects: subjects,
        exam_board: examBoard,
        curriculum: examBoard as "CAPS" | "IEB" | "Cambridge",
        language: language,
      }).eq('user_id', user?.id);

      if (error) throw error;

      // Update app language context
      if (language !== appLanguage) {
        setAppLanguage(language);
      }

      // Sync user_subjects junction table
      try {
        // 1. Get IDs for selected subject names (matching curriculum and grade)
        const { data: subjectRows } = await supabase
          .from('subjects')
          .select('id, name')
          .eq('curriculum', examBoard as any)
          .eq('grade', parseInt(grade))
          .in('name', subjects);

        if (subjectRows) {
          const selectedSubjectIds = subjectRows.map(s => s.id);

          // 2. Delete existing user_subjects for this user
          await supabase
            .from('user_subjects')
            .delete()
            .eq('user_id', user?.id);

          // 3. Insert new user_subjects
          if (selectedSubjectIds.length > 0) {
            const toInsert = selectedSubjectIds.map(id => ({
              user_id: user?.id,
              subject_id: id
            }));
            const { error: insertError } = await supabase
              .from('user_subjects')
              .insert(toInsert);

            if (insertError) {
              console.error('Error inserting user_subjects:', insertError);
            }
          }
        }
      } catch (syncError) {
        console.error('Error syncing user_subjects:', syncError);
        // We don't throw here to avoid failing the whole profile save if sync fails
      }

      toast({ title: t('settings.saved'), description: t('settings.profileUpdated') });
    } catch (error) {
      toast({ title: t('settings.error'), description: t('settings.failedToSave'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: t('settings.error'), description: t('settings.passwordsDoNotMatch'), variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({ title: t('settings.success'), description: t('settings.passwordChanged') });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordDialog(false);
    } catch (error) {
      toast({ title: t('settings.error'), description: t('settings.failedToChangePassword'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAnimations = async () => {
    setSavingAnimationPreference(true);
    try {
      await setAnimationsEnabled(!animationsEnabled);
      toast({
        title: t('settings.success'),
        description: animationsEnabled ? t('settings.animationsDisabled') : t('settings.animationsEnabled'),
      });
    } catch (error) {
      toast({
        title: t('settings.error'),
        description: t('settings.failedToSavePreference'),
        variant: 'destructive',
      });
    } finally {
      setSavingAnimationPreference(false);
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
        <div className="mb-4">
          <h1 className="text-3xl font-display font-bold text-foreground">{t('settings.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('components.manageProfileDescription')}</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Settings Navigation */}
          <SettingsSidebar />
          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* PROFILE SECTION */}
            <Card id="profile" className="scroll-mt-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {t('settings.profile')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Name */}
                <div className="space-y-2">
                  <Label>{t('settings.fullName')}</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('settings.enterYourFullName')} />
                </div>

                {/* Email - Read Only */}
                <div className="space-y-2">
                  <Label>{t('settings.email')}</Label>
                  <Input value={user?.email || ''} disabled placeholder={t('settings.email')} />
                  <p className="text-xs text-muted-foreground">Email cannot be changed from settings</p>
                </div>

                {/* Grade */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('settings.grade')}</Label>
                    <Select value={grade} onValueChange={setGrade}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[8, 9, 10, 11, 12].map(g => (
                          <SelectItem key={g} value={g.toString()}>{t('settings.grade').split('/')[0].trim()} {g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Exam Board */}
                  <div className="space-y-2">
                    <Label>{t('settings.examBoard')}</Label>
                    <Select value={examBoard} onValueChange={setExamBoard}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CAPS">CAPS</SelectItem>
                        <SelectItem value="IEB">IEB</SelectItem>
                        <SelectItem value="Cambridge">Cambridge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Subjects */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    {t('settings.subjectsEnrolled')}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {subjects.length > 0 ? `${subjects.length} ${subjects.length === 1 ? t('settings.subjectsSelected') : t('settings.subjectsSelectedPlural')} selected` : t('settings.selectSubjects')}
                        <ChevronDown className="w-4 h-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96 p-4">
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-muted-foreground">
                          Available subjects for {examBoard} Grade {grade}
                        </p>
                        <div className="max-h-96 overflow-y-auto space-y-2 border rounded-lg p-3 bg-muted/20">
                          {availableSubjects.length > 0 ? (
                            availableSubjects.map(subject => {
                              const isChecked = subjects.includes(subject);
                              return (
                                <div
                                  key={subject}
                                  className={`flex items-center space-x-2 p-2 rounded-md transition-colors ${
                                    isChecked ? 'bg-primary/10' : 'hover:bg-secondary/50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    id={subject}
                                    checked={isChecked}
                                    onChange={() => {
                                      setSubjects(prev =>
                                        prev.includes(subject)
                                          ? prev.filter(s => s !== subject)
                                          : [...prev, subject]
                                      );
                                    }}
                                    className="w-4 h-4 rounded border-border cursor-pointer"
                                  />
                                  <Label
                                    htmlFor={subject}
                                    className={`text-sm font-normal cursor-pointer flex-1 ${
                                      isChecked ? 'text-primary font-semibold' : 'text-foreground'
                                    }`}
                                  >
                                    {subject}
                                  </Label>
                                  {isChecked && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-muted-foreground py-4">No subjects available</p>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Language Preference */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {t('settings.language')}
                  </Label>
                  <LanguageToggle />
                </div>

                {/* Theme Preference */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Theme
                  </Label>
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <span className="text-sm text-muted-foreground">Toggle dark mode</span>
                  </div>
                </div>

                {/* Animation Preference */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Animations
                  </Label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={animationsEnabled}
                      onClick={handleToggleAnimations}
                      disabled={savingAnimationPreference}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                        animationsEnabled ? 'bg-primary' : 'bg-input'
                      }`}
                    >
                      <span
                        className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                          animationsEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm text-foreground">
                      {savingAnimationPreference ? (
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      ) : null}
                      {animationsEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {animationsEnabled
                      ? 'Page entry animations are enabled. Disable them for better performance.'
                      : 'Page entry animations are disabled. Enable them for visual polish.'}
                  </p>
                </div>

                <Button onClick={handleSaveProfile} disabled={loading} className="w-full md:w-auto">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {t('settings.saveProfile')}
                </Button>
              </CardContent>
            </Card>

            {/* PASSWORD SECTION */}
            <Card id="security" className="scroll-mt-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  {t('settings.security')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Lock className="w-4 h-4 mr-2" />
                      {t('settings.changePassword')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t('settings.changePassword')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>{t('settings.currentPassword')}</Label>
                        <div className="relative">
                          <Input
                            type={showPasswords ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder={t('settings.enterCurrentPassword')}
                          />
                          <button
                            onClick={() => setShowPasswords(!showPasswords)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('settings.newPassword')}</Label>
                        <div className="relative">
                          <Input
                            type={showPasswords ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder={t('settings.enterNewPassword')}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('settings.confirmPassword')}</Label>
                        <div className="relative">
                          <Input
                            type={showPasswords ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder={t('settings.confirmNewPassword')}
                          />
                        </div>
                      </div>
                      <Button onClick={handleChangePassword} disabled={loading} className="w-full">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                        {t('settings.changePassword')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default SettingsProfile;
