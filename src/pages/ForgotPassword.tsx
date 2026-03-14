import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { usePageAnimation } from '@/hooks/use-page-animation';
import { z } from 'zod';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { shouldAnimate } = usePageAnimation('ForgotPassword');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();

    try {
      emailSchema.parse({ email: trimmedEmail });

      setLoading(true);

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        toast({
          title: 'Error',
          description: resetError.message,
          variant: 'destructive',
        });
      } else {
        setSuccess(true);
        toast({
          title: 'Password reset email sent',
          description: 'Check your email for password reset instructions.',
        });
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors[0]?.message || 'Invalid input';
        setError(errorMessage);
        toast({
          title: 'Validation Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } else {
        setError(error.message || 'Something went wrong');
        toast({
          title: 'Error',
          description: error.message || 'Something went wrong',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex">
        {/* Left side - Branding */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary/80 p-12 flex-col justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-foreground rounded-xl flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <span className="text-2xl font-display font-bold text-primary-foreground">
              ReBooked Genius
            </span>
          </div>

          <div className="space-y-6">
            <h1 className="text-4xl lg:text-5xl font-display font-bold text-primary-foreground leading-tight">
              Master Your Studies
              <br />
              With AI-Powered Learning
            </h1>
            <p className="text-primary-foreground/80 text-lg max-w-md">
              Your comprehensive learning companion supporting CAPS, IEB, and Cambridge curricula.
              Get instant help, practice with past papers, and track your progress.
            </p>
          </div>

          <div className="flex gap-8 text-primary-foreground/60 text-sm">
            <span>CAPS</span>
            <span>IEB</span>
            <span>Cambridge</span>
          </div>
        </motion.div>

        {/* Right side - Success Message */}
        <div className="flex-1 flex items-center justify-center p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full max-w-md text-center"
          >
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-display font-bold text-foreground">
                ReBooked Genius
              </span>
            </div>

            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <h2 className="text-2xl font-display font-bold text-foreground mb-4">
              Check your email
            </h2>
            <p className="text-muted-foreground mb-2">
              We've sent a password reset link to:
            </p>
            <p className="font-medium text-foreground mb-6">
              {email}
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              Click the link in the email to reset your password. The link expires in 24 hours.
            </p>

            <Button 
              onClick={() => navigate('/auth')}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to login
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Branding */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary/80 p-12 flex-col justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary-foreground rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <span className="text-2xl font-display font-bold text-primary-foreground">
            ReBooked Genius
          </span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl lg:text-5xl font-display font-bold text-primary-foreground leading-tight">
            Master Your Studies
            <br />
            With AI-Powered Learning
          </h1>
          <p className="text-primary-foreground/80 text-lg max-w-md">
            Your comprehensive learning companion supporting CAPS, IEB, and Cambridge curricula.
            Get instant help, practice with past papers, and track your progress.
          </p>
        </div>

        <div className="flex gap-8 text-primary-foreground/60 text-sm">
          <span>CAPS</span>
          <span>IEB</span>
          <span>Cambridge</span>
        </div>
      </motion.div>

      {/* Right side - Reset Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-display font-bold text-foreground">
              ReBooked Genius
            </span>
          </div>
          
          <div className="text-center mb-8">
            <h2 className="text-2xl font-display font-bold text-foreground">
              Reset your password
            </h2>
            <p className="text-muted-foreground mt-2">
              Enter your email and we'll send you a link to reset your password
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full mt-6"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Send reset link'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="text-sm text-primary hover:underline font-medium flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPassword;
