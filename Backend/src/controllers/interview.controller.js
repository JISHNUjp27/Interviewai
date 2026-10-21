const pdfParse = require("pdf-parse")
const {generateInterviewReport, generateResumePdf} = require("../services/ai.service")
const interviewReportModel = require("../models/interview.Report.model")


async function generateInterviewReportController(req, res) {
    try {
        const {selfDescription, jobDescription} = req.body

        // Validate required fields
        if (!jobDescription || jobDescription.trim() === "") {
            return res.status(400).json({
                message: "Job description is required"
            })
        }

        // Check if at least one candidate info source is provided
        const hasResume = req.file && req.file.buffer
        const hasSelfDescription = selfDescription && selfDescription.trim() !== ""

        if (!hasResume && !hasSelfDescription) {
            return res.status(400).json({
                message: "Please provide either a resume or a self-description"
            })
        }

        // Parse resume if provided
        let resumeContent = null
        if (hasResume) {
            try {
                const pdfData = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText()
                resumeContent = pdfData.text
            } catch (pdfError) {
                console.error("PDF parsing error:", pdfError)
                return res.status(400).json({
                    message: "Failed to parse the uploaded resume. Please ensure it's a valid PDF file."
                })
            }
        }

        // Generate interview report
        const interviewReportByAi = await generateInterviewReport({
            resume: resumeContent,
            selfDescription,
            jobDescription
        })

        console.log(JSON.stringify(interviewReportByAi, null, 2))

        // Create interview report in database
       const interviewReport = await interviewReportModel.create({
    user: req.user.id,
    resume: resumeContent,
    selfDescription,
    jobDescription,
    ...interviewReportByAi,
    hasGeneratedResume: false
})

        res.status(201).json({
            message: "Interview Report Generated Successfully",
            interviewReport,
            resumeGenerated: false // Will be true only after successful resume PDF generation
        })
    } catch (error) {
        console.error("Interview generation error:", error)
        res.status(500).json({
            message: "Failed to generate interview report. Please try again.",
            error: error.message
        })
    }
}

async function getInterviewReportByIdController(req, res){
    try {
        const{interviewId} = req.params
        const interviewReport = await interviewReportModel.findOne({_id: interviewId, user:req.user.id})

    if(!interviewReport){
        return res.status(404).json({
            message:"Interview Report not found",
            interviewReport,
        })
    }

    res.status(200).json({
        message:"Interview Report fetched Successfully",
        interviewReport
    })
    } catch (err) {
        console.error("Get report error:", err);
        res.status(500).json({ message: "Could not fetch the report" });
    }   

}

async function getAllInterviewReportsController(req, res){
    const interviewReports = await interviewReportModel.find({user:req.user.id}).sort({createdAt: -1}).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message:"Interview Reports fetched successfully",
        interviewReports
    })
}

async function generateResumePdfController(req, res){
    try {
        const {interviewReportId} = req.params

        const interviewReport = await interviewReportModel.findById(interviewReportId)
        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview Report not found"
            })
        }

        // Check if resume generation is possible
        if (!interviewReport.resume && (!interviewReport.selfDescription || interviewReport.selfDescription.trim() === "")) {
            return res.status(400).json({
                message: "Cannot generate resume: No resume or self-description available"
            })
        }

        const {resume, jobDescription, selfDescription} = interviewReport

        const pdfBuffer = await generateResumePdf({resume, jobDescription, selfDescription})

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        })

        res.send(pdfBuffer)
    } catch (error) {
        console.error("Resume PDF generation error:", error)
        res.status(500).json({
            message: "Failed to generate resume PDF",
            error: error.message
        })
    }
}

module.exports = {generateInterviewReportController, getInterviewReportByIdController, getAllInterviewReportsController, generateResumePdfController}


