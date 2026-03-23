import { motion } from 'framer-motion';
import { MessageSquare, Users, HelpCircle, MessageCircle, Mail, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const NBTSupport = () => {
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

  const forums = [
    {
      title: 'General Discussion',
      members: 2450,
      posts: 8932,
      desc: 'Ask questions and share experiences with other NBT takers',
      activity: 'Very Active',
    },
    {
      title: 'Mathematics (MAT) Help',
      members: 1820,
      posts: 5234,
      desc: 'Dedicated space for MAT questions and solutions',
      activity: 'Active',
    },
    {
      title: 'Academic Literacy (AL)',
      members: 1650,
      posts: 4521,
      desc: 'Discuss reading comprehension and critical reasoning',
      activity: 'Active',
    },
    {
      title: 'Academic & Quantitative Literacy (AQL)',
      members: 1340,
      posts: 3892,
      desc: 'Share data interpretation tips and problem solutions',
      activity: 'Active',
    },
    {
      title: 'Test Experiences',
      members: 980,
      posts: 2341,
      desc: 'Share your NBT experiences and get advice',
      activity: 'Moderately Active',
    },
    {
      title: 'Study Groups',
      members: 752,
      posts: 1850,
      desc: 'Find study partners and form group study sessions',
      activity: 'Moderately Active',
    },
  ];

  const faqs = [
    {
      q: 'I scored lower than expected, what should I do?',
      a: 'Take time to analyze your mistakes, focus on weak areas, and consider retaking the test. Many universities accept retakes.',
    },
    {
      q: 'How can I prepare better for AQL?',
      a: 'Read regularly, practice identifying main ideas, analyze arguments, and review grammar rules. Our study materials have dedicated AQL sections.',
    },
    {
      q: 'What if I fail the NBT?',
      a: 'You can retake the test anytime. Some universities offer academic development programs. Start with diagnostic tests to identify areas to focus on.',
    },
    {
      q: 'How do I balance NBT prep with schoolwork?',
      a: 'Create a study schedule, dedicate 45-min focused sessions, and prioritize based on your weakest sections. Use weekends for longer practice tests.',
    },
    {
      q: 'Should I join a study group?',
      a: 'Yes! Study groups help with motivation and explaining concepts. Join our community forums to find study partners.',
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
              Support & Community
            </h2>
            <p className="text-foreground/80">
              Get help from tutors, connect with peers, and access comprehensive support.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Support Channels */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mb-3">
              <MessageCircle className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-bold text-foreground mb-2">Live Chat Support</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Chat with tutors during business hours
            </p>
            <Button size="sm" className="w-full">
              Start Chat
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mb-3">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-bold text-foreground mb-2">Email Support</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get detailed answers within 24 hours
            </p>
            <Button size="sm" variant="outline" className="w-full">
              Send Email
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-bold text-foreground mb-2">Community Forum</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ask questions and learn from peers
            </p>
            <Button size="sm" variant="outline" className="w-full">
              Visit Forum
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="forums" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="forums">Discussion Forums</TabsTrigger>
          <TabsTrigger value="events">Q&A Sessions</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
        </TabsList>

        {/* Forums */}
        <TabsContent value="forums" className="space-y-3 mt-6">
          {forums.map((forum) => (
            <Card key={forum.title} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-foreground">{forum.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{forum.desc}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-4 ${
                    forum.activity === 'Very Active'
                      ? 'bg-green-500/20 text-green-700'
                      : forum.activity === 'Active'
                      ? 'bg-blue-500/20 text-blue-700'
                      : 'bg-amber-500/20 text-amber-700'
                  }`}>
                    {forum.activity}
                  </span>
                </div>

                <div className="flex items-center gap-6 text-sm text-foreground/70 mb-4">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {forum.members.toLocaleString()} members
                  </span>
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    {forum.posts.toLocaleString()} posts
                  </span>
                </div>

                <Button size="sm" className="w-full">
                  Join Discussion
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Q&A Sessions */}
        <TabsContent value="events" className="space-y-3 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Q&A Sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  day: 'Monday',
                  time: '7:00 PM - 8:00 PM',
                  topic: 'Mathematics (MAT) - Algebra & Calculus',
                  tutor: 'Mr. Okonkwo',
                },
                {
                  day: 'Wednesday',
                  time: '7:00 PM - 8:00 PM',
                  topic: 'Academic Literacy (AQL) - Critical Reasoning',
                  tutor: 'Dr. Smith',
                },
                {
                  day: 'Friday',
                  time: '6:00 PM - 7:00 PM',
                  topic: 'AQL - Data & Graphs',
                  tutor: 'Ms. Patel',
                },
                {
                  day: 'Saturday',
                  time: '10:00 AM - 11:00 AM',
                  topic: 'Test Strategies & Time Management',
                  tutor: 'Coach James',
                },
              ].map((session, idx) => (
                <div key={idx} className="border border-border rounded-lg p-4 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-bold text-foreground">{session.day}</h4>
                      <p className="text-sm text-muted-foreground">{session.time}</p>
                    </div>
                    <span className="px-2 py-1 bg-primary/20 text-primary rounded text-xs font-medium">
                      Live
                    </span>
                  </div>
                  <p className="text-sm text-foreground mb-2">{session.topic}</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Hosted by {session.tutor}
                  </p>
                  <Button size="sm" variant="outline" className="w-full">
                    Register
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Study Groups</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground/80 mb-4">
                Join thousands of students in active WhatsApp study groups
              </p>
              <Button className="w-full mb-3">
                Join WhatsApp Community
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                24/7 peer support and discussion
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQ */}
        <TabsContent value="faq" className="space-y-3 mt-6">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {faqs.map((faq, idx) => (
                  <div key={idx} className="border-b border-border last:border-0 pb-4 last:pb-0">
                    <h4 className="font-bold text-foreground mb-2 flex items-start gap-2">
                      <HelpCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      {faq.q}
                    </h4>
                    <p className="text-sm text-foreground/80 ml-7">{faq.a}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tutor Profiles */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Meet Our Expert Tutors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  name: 'Dr. Michael Smith',
                  speciality: 'Academic Literacy',
                  exp: '8 years',
                  students: '500+',
                },
                {
                  name: 'Prof. Rajesh Patel',
                  speciality: 'Mathematics',
                  exp: '10 years',
                  students: '1000+',
                },
                {
                  name: 'Ms. Amara Okonkwo',
                  speciality: 'AQL (Quantitative)',
                  exp: '6 years',
                  students: '400+',
                },
              ].map((tutor, idx) => (
                <div key={idx} className="border border-border rounded-lg p-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/20 mb-3 flex items-center justify-center">
                    <span className="font-bold text-primary text-lg">
                      {tutor.name.split(' ')[0][0]}
                    </span>
                  </div>
                  <h4 className="font-bold text-foreground mb-1">{tutor.name}</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Specialist in {tutor.speciality}
                  </p>
                  <div className="space-y-1 text-xs text-foreground/80 mb-3">
                    <p>Experience: {tutor.exp}</p>
                    <p>Helped: {tutor.students} students</p>
                  </div>
                  <Button size="sm" variant="outline" className="w-full">
                    Book Session
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Contact Info */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <h3 className="font-bold text-foreground mb-4">Contact Information</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <Phone className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Phone Support</p>
                  <p className="text-sm text-foreground/80">+27 11 123 4567</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Mail className="w-5 h-5 text-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">Email Support</p>
                  <p className="text-sm text-foreground/80">support@nbtprep.com</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default NBTSupport;
