import { motion } from 'framer-motion';
import { BarChart3, LineChart, PieChart, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const NBTDataInterpretation = () => {
  const navigate = useNavigate();
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

  const dataExamples = [
    {
      title: 'Bar Chart Analysis',
      description: 'Learn to read and interpret bar charts comparing categories',
      icon: BarChart3,
      sample: 'Sales comparison across quarters',
      type: 'bar-chart'
    },
    {
      title: 'Line Graph Trends',
      description: 'Analyze trends and patterns in line graphs',
      icon: LineChart,
      sample: 'Temperature changes over time',
      type: 'line-graph'
    },
    {
      title: 'Pie Charts & Percentages',
      description: 'Interpret proportions and percentages in pie charts',
      icon: PieChart,
      sample: 'Budget allocation breakdown',
      type: 'pie-chart'
    },
    {
      title: 'Trend Analysis',
      description: 'Identify patterns and make predictions from data',
      icon: TrendingUp,
      sample: 'Population growth patterns',
      type: 'trend-analysis'
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
              Data Interpretation & Graphs
            </h2>
            <p className="text-foreground/80">
              Master reading and analyzing graphs, charts, tables, and real-world data like in the actual NBT.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Graph Types */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dataExamples.map((example) => {
            const Icon = example.icon;
            return (
              <Card key={example.title} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <Icon className="w-8 h-8 text-primary mb-3" />
                  <h3 className="font-bold text-foreground mb-1">{example.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {example.description}
                  </p>
                  <div className="bg-secondary/50 p-3 rounded mb-4 text-sm">
                    <span className="text-foreground/70">Example: </span>
                    <span className="text-foreground font-medium">{example.sample}</span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/nbt/graph-practice/${example.type}`)}
                  >
                    Practice Now
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>



      {/* Tips & Strategies */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Tips for Data Interpretation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">✓ Do This</h4>
                <ul className="text-sm text-foreground/80 space-y-2">
                  <li>• Read axis labels carefully</li>
                  <li>• Look for patterns and trends</li>
                  <li>• Check data units (%, absolute, etc)</li>
                  <li>• Calculate rates of change</li>
                  <li>• Use process of elimination</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">✗ Avoid This</h4>
                <ul className="text-sm text-foreground/80 space-y-2">
                  <li>• Making assumptions without data</li>
                  <li>• Misreading scales or units</li>
                  <li>• Ignoring outliers or anomalies</li>
                  <li>• Rushing to conclusions</li>
                  <li>• Overlooking comparative data</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default NBTDataInterpretation;
