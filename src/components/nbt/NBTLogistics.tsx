import { motion } from 'framer-motion';
import { Calendar, MapPin, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const NBTLogistics = () => {
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

  const upcomingTests = [
    {
      date: 'January 15, 2025',
      venue: 'University of Cape Town',
      closingDate: 'January 8, 2025',
      status: 'open',
    },
    {
      date: 'January 22, 2025',
      venue: 'Wits University',
      closingDate: 'January 15, 2025',
      status: 'open',
    },
    {
      date: 'February 5, 2025',
      venue: 'Stellenbosch University',
      closingDate: 'January 29, 2025',
      status: 'open',
    },
    {
      date: 'February 12, 2025',
      venue: 'University of Johannesburg',
      closingDate: 'February 5, 2025',
      status: 'open',
    },
  ];

  const faqs = [
    {
      q: 'How do I register for the NBT?',
      a: 'You can register through the HESA website (www.hesa.org.za) or contact your chosen university directly. Registration requires a valid ID and proof of matric.',
    },
    {
      q: 'What is the registration fee?',
      a: 'The NBT registration fee is R350 (subject to change). Some universities may offer subsidized registration for qualifying students.',
    },
    {
      q: 'Can I reschedule my test date?',
      a: 'Yes, you can reschedule up to 7 days before your test for a R100 administrative fee. Contact the test center directly.',
    },
    {
      q: 'What documents do I need to bring?',
      a: 'Bring a valid ID (passport or ID book), admission letter from the university, and any other documents specified in your test letter.',
    },
    {
      q: 'How long is the NBT valid?',
      a: 'NBT results are valid for 2 years from the test date for university admission purposes.',
    },
    {
      q: 'Can I retake the NBT?',
      a: 'Yes, you can retake the test, but each attempt must be registered and paid for separately.',
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
              Registration & Test Logistics
            </h2>
            <p className="text-foreground/80">
              Find test dates, venues, registration info, and important deadlines.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Info */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-1">Registration Fee</h3>
                <p className="text-2xl font-bold text-primary mb-1">R350</p>
                <p className="text-xs text-foreground/70">Includes all three sections</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-1">Total Duration</h3>
                <p className="text-2xl font-bold text-primary mb-1">3.5 Hours</p>
                <p className="text-xs text-foreground/70">Including breaks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Upcoming Test Dates */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Upcoming Test Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingTests.map((test, idx) => (
              <div key={idx} className="border border-border rounded-lg p-4 hover:bg-secondary/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-foreground">{test.date}</h4>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {test.venue}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    test.status === 'open'
                      ? 'bg-green-500/20 text-green-700'
                      : 'bg-amber-500/20 text-amber-700'
                  }`}>
                    {test.status === 'open' ? 'Registrations Open' : 'Closing Soon'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Registration closes: {test.closingDate}
                </p>
                <Button size="sm" className="w-full">
                  Register Now
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Step-by-Step Registration */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>How to Register</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  step: 1,
                  title: 'Prepare Documents',
                  desc: 'Gather valid ID, matric certificate, and proof of address',
                },
                {
                  step: 2,
                  title: 'Choose Test Date & Venue',
                  desc: 'Select from available dates and testing centers',
                },
                {
                  step: 3,
                  title: 'Register Online',
                  desc: 'Visit HESA website or university registration portal',
                },
                {
                  step: 4,
                  title: 'Make Payment',
                  desc: 'Pay R350 registration fee by your chosen method',
                },
                {
                  step: 5,
                  title: 'Receive Confirmation',
                  desc: 'Get test letter with date, time, and venue details',
                },
                {
                  step: 6,
                  title: 'Attend Test',
                  desc: 'Arrive 30 minutes early with required documents',
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 flex-shrink-0">
                    <span className="font-bold text-primary text-sm">{item.step}</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Important Info */}
      <motion.div variants={itemVariants}>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Important Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-foreground text-sm">Arrive Early</h4>
                <p className="text-sm text-foreground/80">Arrive 30 minutes before your test time</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-foreground text-sm">Required Documents</h4>
                <p className="text-sm text-foreground/80">Valid ID and test letter are mandatory</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-foreground text-sm">Electronic Devices</h4>
                <p className="text-sm text-foreground/80">No phones, calculators, or smartwatches allowed</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-foreground text-sm">Results Timeline</h4>
                <p className="text-sm text-foreground/80">Results available 4-6 weeks after the test</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* FAQ */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border-b border-border last:border-0 pb-4 last:pb-0">
                  <h4 className="font-medium text-foreground mb-2">{faq.q}</h4>
                  <p className="text-sm text-foreground/80">{faq.a}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Contact Support */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-bold mb-2 text-foreground">Need Help?</h3>
            <p className="text-foreground/80 mb-4">
              Contact the HESA Support Center for registration assistance
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button variant="outline">Email Support</Button>
              <Button>Call HESA Helpline</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default NBTLogistics;
