import React, { useState, useMemo, useDeferredValue } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { SA_SCHOOLS } from '@/data/sa-schools';
import { CURRICULA, GRADES, Curriculum, Grade, getSubjectsByCurriculumAndGrade, getCurriculumEnumValue, getAllSubjectsByCurriculum } from '@/data/curricula';
import { Search, BookOpen, Building2, Globe, Sparkles, CheckCircle2, GraduationCap } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import confetti from 'canvas-confetti';

interface FirstLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FirstLoginModal: React.FC<FirstLoginModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setLanguage } = useLanguage();
  const [step, setStep] = useState(0);
  const [selectedCurriculum, setSelectedCurriculum] = useState<Curriculum | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState<string>('');
  const deferredSchoolSearch = useDeferredValue(schoolSearch);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'af', name: 'Afrikaans' },
  ];

  // Get ALL subjects for selected curriculum
  const availableSubjects = useMemo(() => {
    if (!selectedCurriculum) return [];
    return getAllSubjectsByCurriculum(selectedCurriculum);
  }, [selectedCurriculum]);

  // Filter schools based on deferred search
  const filteredSchools = useMemo(() => {
    if (!deferredSchoolSearch.trim()) return SA_SCHOOLS.slice(0, 10);
    return SA_SCHOOLS.filter(school =>
      school.toLowerCase().includes(deferredSchoolSearch.toLowerCase())
    );
  }, [deferredSchoolSearch]);

  const handleSubjectToggle = (subject: string) => {
    setSelectedSubjects(prev =>
      prev.includes(subject)
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    );
  };

  const handleNext = () => {
    if (step === 1 && !selectedCurriculum) {
      toast({
        title: 'Please select a curriculum',
        description: 'You need to select your curriculum to continue.',
        variant: 'destructive',
      });
      return;
    }
    if (step === 2 && !selectedGrade) {
      toast({
        title: 'Please select a grade',
        description: 'You need to select your grade to continue.',
        variant: 'destructive',
      });
      return;
    }
    if (step === 3 && selectedSubjects.length === 0) {
      toast({
        title: 'Please select at least one subject',
        description: 'You need to select at least one subject to continue.',
        variant: 'destructive',
      });
      return;
    }
    if (step === 4 && !selectedSchool.trim()) {
      toast({
        title: 'Please select your school',
        description: 'You need to enter or choose your school to continue.',
        variant: 'destructive',
      });
      return;
    }
    if (step === 5 && !selectedLanguage) {
      toast({
        title: 'Please select a language',
        description: 'Please choose your preferred language.',
        variant: 'destructive',
      });
      return;
    }
    setStep(step + 1);
  };

  const handlePrev = () => {
    setStep(step - 1);
  };

  const handleSelectSchool = (school: string) => {
    setSelectedSchool(school);
    setSchoolSearch(school);
    setShowSchoolDropdown(false);
  };

  const handleComplete = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          curriculum: getCurriculumEnumValue(selectedCurriculum),
          grade: parseInt(selectedGrade || '12'),
          subjects: selectedSubjects,
          school: selectedSchool.trim(),
          language: selectedLanguage,
          login_count: 1,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Save to user_subjects table for persistence
      if (selectedSubjects.length > 0) {
        // Fetch matching subjects to get their IDs
        const { data: dbSubjects } = await supabase
          .from('subjects')
          .select('id, name')
          .in('name', selectedSubjects)
          .eq('curriculum', getCurriculumEnumValue(selectedCurriculum));

        const foundSubjectNames = new Set((dbSubjects || []).map(s => s.name));
        const missingSubjectNames = selectedSubjects.filter(name => !foundSubjectNames.has(name));

        // Create missing subjects in the DB so they show up in Past Papers
        let newlyCreatedSubjects: { id: string; name: string }[] = [];
        if (missingSubjectNames.length > 0) {
          const subjectsToCreate = missingSubjectNames.map(name => ({
            name,
            curriculum: getCurriculumEnumValue(selectedCurriculum),
            code: name.toLowerCase().replace(/\s+/g, '-').substring(0, 20),
          }));

          const { data: createdSubjects, error: createError } = await supabase
            .from('subjects')
            .insert(subjectsToCreate)
            .select('id, name');

          if (createError) {
            console.error('Error creating missing subjects:', createError);
          } else if (createdSubjects) {
            newlyCreatedSubjects = createdSubjects;
          }
        }

        const allDbSubjects = [...(dbSubjects || []), ...newlyCreatedSubjects];

        if (allDbSubjects.length > 0) {
          const userSubjectsToInsert = allDbSubjects.map(s => ({
            user_id: user.id,
            subject_id: s.id
          }));
          
          // First clear existing if any (unlikely for first login but good practice)
          await supabase.from('user_subjects').delete().eq('user_id', user.id);
          const { error: subjectError } = await supabase.from('user_subjects').insert(userSubjectsToInsert);
          if (subjectError) console.error('Error saving user_subjects:', subjectError);
        }
      }

      // Trigger welcome notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Welcome to ReBooked Genius!',
        message: 'Your profile is all set up. Upgrade to Pro to unlock unlimited features!',
        type: 'welcome',
        link: '/settings/billing'
      });

      // Trigger welcome email via Edge Function
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: user.email,
            subject: 'Welcome to ReBooked Genius!',
            template: 'welcome',
            props: {
              name: firstName,
              cta_link: 'https://rebooked-genius.com/settings/billing'
            }
          }
        });
      } catch (emailErr) {
        console.error('Failed to trigger welcome email:', emailErr);
      }

      // Update app language immediately if selected
      if (selectedLanguage === 'en' || selectedLanguage === 'af') {
        setLanguage(selectedLanguage as 'en' | 'af');
      }

      // Trigger confetti celebration
      triggerConfetti();

      toast({
        title: 'Welcome to ReBooked Genius!',
        description: 'Your profile has been set up successfully.',
      });

      // Close modal after a short delay to let user see confetti
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Error updating profile:', err);
      toast({
        title: 'Error',
        description: 'Failed to save your preferences. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Student';

  const triggerConfetti = () => {
    // Confetti burst from center
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981']
    });

    // Additional burst
    setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#8b5cf6', '#ec4899']
      });
    }, 250);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg w-[95vw] sm:w-full mx-auto max-h-[90vh] overflow-y-auto [&>button]:hidden p-4 sm:p-6">
        {/* Progress indicator - show for steps 1-6 only */}
        {step > 0 && step < 7 && (
          <div className="flex gap-1 sm:gap-2 mb-4">
            {[1, 2, 3, 4, 5, 6].map(num => (
              <div
                key={num}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  step >= num ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="space-y-4 text-center py-2">
              <DialogHeader>
                <div className="flex justify-center mb-1">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <DialogTitle className="text-xl sm:text-2xl font-bold">
                  Welcome to ReBooked Genius
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm sm:text-base">
                <p className="text-base font-medium text-muted-foreground">
                  Hi {firstName}!
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  We're excited to have you on board. Let's personalize your learning journey with a few quick questions.
                </p>
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3 text-left">
                  <p className="text-xs sm:text-sm font-semibold text-foreground">What we'll set up:</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                      Curriculum
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                      Grade
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                      Subjects
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                      School
                    </li>
                  </ul>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                  ⚡ Takes less than 2 minutes
                </p>
              </div>
              <Button onClick={handleNext} className="w-full py-6 text-base font-semibold shadow-lg shadow-primary/20">
                Let's Get Started
              </Button>
            </div>
          )}

          {/* Step 1: Curriculum Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex justify-center mb-1">
                  <GraduationCap className="w-8 h-8 text-primary" />
                </div>
                <DialogTitle className="text-center text-lg sm:text-xl font-bold">
                  What curriculum do you follow?
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-2 sm:gap-3">
                {Object.entries(CURRICULA).map(([key, curriculum]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCurriculum(key as Curriculum)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      selectedCurriculum === key
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-muted hover:border-primary/30 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                          selectedCurriculum === key
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground'
                        }`}
                      >
                        {selectedCurriculum === key && (
                          <span className="text-white text-[10px]">✓</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm flex items-center gap-2">
                          <span className="text-lg">{curriculum.icon}</span>
                          {curriculum.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{curriculum.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  className="flex-[2] font-semibold"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Grade Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex justify-center mb-1">
                  <GraduationCap className="w-8 h-8 text-primary" />
                </div>
                <DialogTitle className="text-center text-lg sm:text-xl font-bold">
                  What grade are you in?
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {GRADES.map(grade => (
                  <button
                    key={grade}
                    onClick={() => setSelectedGrade(grade as Grade)}
                    className={`p-3 rounded-xl border-2 transition-all font-bold text-center ${
                      selectedGrade === grade
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-muted hover:border-primary/30 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg">{grade}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Grade</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  className="flex-[2] font-semibold"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Subjects */}
          {step === 3 && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex justify-center mb-1">
                  <BookOpen className="w-8 h-8 text-primary" />
                </div>
                <DialogTitle className="text-center text-lg sm:text-xl font-bold">
                  Select your subjects
                </DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground text-center">
                Choose the subjects you study in Grade {selectedGrade}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto pr-1">
                {availableSubjects.map(subject => (
                  <button
                    key={subject}
                    onClick={() => handleSubjectToggle(subject)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      selectedSubjects.includes(subject)
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-muted hover:border-primary/30 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                          selectedSubjects.includes(subject)
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground'
                        }`}
                      >
                        {selectedSubjects.includes(subject) && (
                          <span className="text-white text-[10px]">✓</span>
                        )}
                      </div>
                      <span className="font-semibold text-xs leading-tight">{subject}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  className="flex-[2] font-semibold"
                >
                  Continue ({selectedSubjects.length})
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: School with Search */}
          {step === 4 && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex justify-center mb-1">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <DialogTitle className="text-center text-lg sm:text-xl font-bold">
                  Which school do you attend?
                </DialogTitle>
              </DialogHeader>

              <div className="relative">
                <Popover open={showSchoolDropdown && !!schoolSearch} onOpenChange={setShowSchoolDropdown}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search your school or type to add..."
                        value={schoolSearch}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSchoolSearch(value);
                          setSelectedSchool(value);
                          setShowSchoolDropdown(true);
                        }}
                        onFocus={() => setShowSchoolDropdown(true)}
                        className="pl-10 h-12 text-sm rounded-xl"
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="p-1 w-[var(--radix-popover-trigger-width)] rounded-xl border-2 shadow-2xl z-[9999]" 
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    align="start"
                  >
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      {filteredSchools.length > 0 ? (
                        <>
                          {filteredSchools.map((school, idx) => (
                            <button
                              key={`${school}-${idx}`}
                              onClick={() => handleSelectSchool(school)}
                              className="w-full text-left px-4 py-3 hover:bg-muted rounded-lg transition-colors text-sm font-medium whitespace-normal break-words"
                            >
                              {school}
                            </button>
                          ))}
                          <div className="h-px bg-muted my-1" />
                          <button
                            onClick={() => handleSelectSchool(schoolSearch)}
                            className="w-full text-left px-4 py-3 hover:bg-primary/5 rounded-lg transition-colors text-sm font-bold text-primary flex items-start gap-2 whitespace-normal break-words"
                          >
                            <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>Use "{schoolSearch}"</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleSelectSchool(schoolSearch)}
                          className="w-full text-left px-4 py-4 hover:bg-primary/5 rounded-lg transition-colors text-sm font-bold text-primary flex items-start gap-2 whitespace-normal break-words"
                        >
                          <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>Add "{schoolSearch}" as my school</span>
                        </button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {selectedSchool && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Selected School</p>
                    <p className="text-sm font-bold break-words">{selectedSchool}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={!selectedSchool.trim()}
                  className="flex-[2] font-semibold"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Language */}
          {step === 5 && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex justify-center mb-1">
                  <Globe className="w-8 h-8 text-primary" />
                </div>
                <DialogTitle className="text-center text-lg sm:text-xl font-bold">
                  App Language
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-2">
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setSelectedLanguage(lang.code)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selectedLanguage === lang.code
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-muted hover:border-primary/30 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                          selectedLanguage === lang.code
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground'
                        }`}
                      >
                        {selectedLanguage === lang.code && (
                          <span className="text-white text-[10px]">✓</span>
                        )}
                      </div>
                      <span className="font-bold text-sm">{lang.name}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleNext}
                  className="flex-[2] font-semibold"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 6: Summary */}
          {step === 6 && (
            <div className="space-y-4 text-center py-2">
              <DialogHeader>
                <div className="flex justify-center mb-1">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                </div>
                <DialogTitle className="text-2xl font-bold">
                  Ready to start!
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Excellent! We've tailored your experience to:
                </p>

                <div className="grid grid-cols-2 gap-2 text-left">
                  <div className="p-3 rounded-xl bg-muted/50 border border-muted">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">Curriculum</p>
                    <p className="text-xs font-bold">{CURRICULA[selectedCurriculum!]?.name}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/50 border border-muted">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">Grade</p>
                    <p className="text-xs font-bold">Grade {selectedGrade}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/50 border border-muted col-span-2">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Subjects</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedSubjects.slice(0, 4).map(subject => (
                        <Badge key={subject} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {subject}
                        </Badge>
                      ))}
                      {selectedSubjects.length > 4 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          +{selectedSubjects.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/50 border border-muted col-span-2">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">School</p>
                    <p className="text-xs font-bold truncate">{selectedSchool}</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleComplete}
                disabled={isLoading}
                className="w-full py-6 text-base font-bold shadow-lg shadow-primary/20 mt-4"
              >
                {isLoading ? 'Setting up...' : 'Start Learning'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FirstLoginModal;
