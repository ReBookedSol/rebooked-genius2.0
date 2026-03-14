import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { addWatermarkToPdf } from './pdfWatermark';
import { supabase } from '@/integrations/supabase/client';

interface AssessmentEntry {
  name: string;
  score: number;
  max_score: number;
  percentage: number;
  type: string;
  date: string;
}

interface SubjectExportData {
  name: string;
  combinedPercentage: number;
  assessments: AssessmentEntry[];
}

export async function exportAnalyticsToPDF(userId: string, userName: string): Promise<void> {
  try {
    // 1. Fetch all data
    const { data: summaries } = await supabase
      .from('subject_analytics_summary')
      .select('*')
      .eq('user_id', userId);

    if (!summaries || summaries.length === 0) {
      throw new Error('No analytics data found to export');
    }

    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, name')
      .in('id', summaries.map(s => s.subject_id));

    const subjectNameMap = new Map(subjects?.map(s => [s.id, s.name]));

    const exportData: SubjectExportData[] = await Promise.all(summaries.map(async (summary) => {
      const { data: quizAnalytics } = await supabase
        .from('quiz_performance_analytics')
        .select('id, score, max_score, percentage, knowledge_id, completed_at, quizzes(title), knowledge_base(title)')
        .eq('user_id', userId)
        .eq('subject_id', summary.subject_id);

      const quizExams: AssessmentEntry[] = (quizAnalytics || []).map(q => ({
        name: q.knowledge_id ? (q.knowledge_base as any)?.title || 'Exam' : (q.quizzes as any)?.title || 'Quiz',
        score: q.score || 0,
        max_score: q.max_score || 0,
        percentage: q.percentage || 0,
        type: q.knowledge_id ? 'Exam' : 'Quiz',
        date: new Date(q.completed_at).toLocaleDateString()
      }));

      const { data: paperAttempts } = await supabase
        .from('past_paper_attempts')
        .select('id, score, max_score, completed_at, documents(title, subject_id)')
        .eq('user_id', userId);
      
      const papers: AssessmentEntry[] = (paperAttempts || [])
        .filter((p: any) => p.documents?.subject_id === summary.subject_id)
        .map(p => ({
          name: (p.documents as any)?.title || 'Past Paper',
          score: p.score || 0,
          max_score: p.max_score || 0,
          percentage: (p.score / p.max_score) * 100,
          type: 'Past Paper',
          date: new Date(p.completed_at).toLocaleDateString()
        }));

      const allAssessments = [...quizExams, ...papers].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      let totalObtained = 0;
      let totalPossible = 0;
      allAssessments.forEach(a => {
        totalObtained += a.score;
        totalPossible += a.max_score;
      });
      const combinedPercentage = totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;

      return {
        name: subjectNameMap.get(summary.subject_id) || 'Unknown Subject',
        combinedPercentage,
        assessments: allAssessments
      };
    }));

    // 2. Create PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    let y = height - 50;

    // Header
    page.drawText('ReBooked Genius - Analytics Report', { x: 50, y, size: 20, font: boldFont, color: rgb(0, 0, 0) });
    y -= 25;
    page.drawText(`User: ${userName}`, { x: 50, y, size: 12, font });
    y -= 15;
    page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: 50, y, size: 12, font });
    y -= 40;

    // Subject Summaries
    page.drawText('Subject Summaries', { x: 50, y, size: 16, font: boldFont });
    y -= 25;

    for (const data of exportData) {
      if (y < 100) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - 50;
      }
      page.drawText(`${data.name}: ${Math.round(data.combinedPercentage)}%`, { x: 70, y, size: 12, font: boldFont });
      y -= 20;
    }

    y -= 20;

    // Subject Breakdowns
    page.drawText('Detailed Breakdown', { x: 50, y, size: 16, font: boldFont });
    y -= 30;

    for (const data of exportData) {
      if (y < 150) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - 50;
      }

      page.drawText(data.name, { x: 50, y, size: 14, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
      y -= 20;

      // Table Header
      page.drawText('Assessment', { x: 60, y, size: 10, font: boldFont });
      page.drawText('Type', { x: 250, y, size: 10, font: boldFont });
      page.drawText('Score', { x: 350, y, size: 10, font: boldFont });
      page.drawText('Percentage', { x: 450, y, size: 10, font: boldFont });
      y -= 15;
      page.drawLine({ start: { x: 50, y }, end: { x: 550, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
      y -= 15;

      for (const ass of data.assessments) {
        if (y < 50) {
          page = pdfDoc.addPage([595.28, 841.89]);
          y = height - 50;
          // Redraw header on new page? Maybe too complex for now, just keep going.
        }

        const truncatedName = ass.name.length > 35 ? ass.name.substring(0, 32) + '...' : ass.name;
        page.drawText(truncatedName, { x: 60, y, size: 9, font });
        page.drawText(ass.type, { x: 250, y, size: 9, font });
        page.drawText(`${ass.score}/${ass.max_score}`, { x: 350, y, size: 9, font });
        page.drawText(`${Math.round(ass.percentage)}%`, { x: 450, y, size: 9, font });
        y -= 15;
      }
      y -= 20;
    }

    // 3. Save and Add Watermark
    const pdfBytes = await pdfDoc.save();
    const watermarkedBytes = await addWatermarkToPdf(pdfBytes.buffer as ArrayBuffer);

    // 4. Download
    const blob = new Blob([watermarkedBytes as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Analytics_Report_${userName.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Error exporting analytics:', error);
    throw error;
  }
}
