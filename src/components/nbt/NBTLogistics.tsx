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
      date: 'May 17, 2026',
      venue: 'University of Cape Town / Online',
      closingDate: 'May 10, 2026',
      status: 'open',
    },
    {
      date: 'June 7, 2026',
      venue: 'Wits University / Online',
      closingDate: 'May 31, 2026',
      status: 'open',
    },
    {
      date: 'June 28, 2026',
      venue: 'Stellenbosch University / Online',
      closingDate: 'June 21, 2026',
      status: 'open',
    },
    {
      date: 'July 12, 2026',
      venue: 'University of Johannesburg / Online',
      closingDate: 'July 5, 2026',
      status: 'open',
    },
  ];

  const faqs = [
    {
      q: 'How do I register for the NBT?',
      a: 'Registration is done through the official NBT website (www.nbt.ac.za). You will need your SA ID or passport number to create an account.',
    },
    {
      q: 'What are the registration fees for 2026?',
      a: 'The AQL test costs R195, and if you write both AQL and MAT, the total cost is R390. Payments are made via Lesaka EasyPay.',
    },
    {
      q: 'Can I reschedule my test date?',
      a: 'Yes, you can reschedule your test on the NBT website, but you must do so at least one week before your scheduled date.',
    },
    {
      q: 'What should I bring to the test center?',
      a: 'You must bring your official ID document, your registration letter (emailed to you after payment), and 2B pencils with an eraser.',
    },
    {
      q: 'How long are NBT results valid?',
      a: 'NBT results are typically valid for three years, but most universities require you to write the NBT during the year prior to your entry year.',
    },
    {
      q: 'When will I get my results?',
      a: 'Results are released directly to universities and are available on the NBT website approximately 4 weeks after your test date.',
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
                <p className="text-2xl font-bold text-primary mb-1">R195 - R390</p>
                <p className="text-xs text-foreground/70">AQL only (R195) or AQL+MAT (R390)</p>
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
                  desc: 'Visit the official website at www.nbt.ac.za to book your session',
                },
                {
                  step: 4,
                  title: 'Make Payment',
                  desc: 'Pay via EasyPay or EFT before the registration deadline',
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
                <p className="text-sm text-foreground/80">Results available roughly 4 weeks after the test</p>
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
              Visit the official NBT portal for the most accurate and up-to-date information
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button variant="outline" onClick={() => window.open('https://nbt.ac.za', '_blank')}>Visit nbt.ac.za</Button>
              <Button onClick={() => window.open('https://nbt.ac.za/content/contact-us', '_blank')}>Contact NBT Project</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default NBTLogistics;
