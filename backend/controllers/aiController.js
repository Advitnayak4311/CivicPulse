const Complaint = require('../models/Complaint');
const Department = require('../models/Department');

/**
 * @desc    Process chatbot message and return AI-generated response
 * @route   POST /api/ai/chat
 * @access  Public
 */
const handleChat = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // 1. Check if the message contains a complaint ID (e.g. CIV-20260712-78330)
    const idRegex = /CIV-\d{8}-\d+/gi;
    const match = message.match(idRegex);
    if (match) {
      const refId = match[0].toUpperCase();
      const complaint = await Complaint.findOne({ complaintId: refId })
        .populate('departmentId', 'departmentName officerName officerEmail');
      
      if (complaint) {
        let responseText = `🔍 **I found complaint ${refId} in our system:**\n\n`;
        responseText += `• **Title:** ${complaint.title}\n`;
        responseText += `• **Category:** ${complaint.category}\n`;
        responseText += `• **Status:** **${complaint.status}**\n`;
        responseText += `• **Priority:** ${complaint.priority}\n`;
        responseText += `• **Assigned Department:** ${complaint.departmentId ? complaint.departmentId.departmentName : 'Unassigned'}\n`;
        if (complaint.remarks) {
          responseText += `• **Latest Remarks:** _"${complaint.remarks}"_\n`;
        }
        responseText += `\nYou can track live updates on the [Complaint Tracking Page](complaint-details.html?ref=${refId}).`;
        return res.status(200).json({ success: true, response: responseText });
      }
    }

    // 2. Call Gemini API if key is available
    if (process.env.GEMINI_API_KEY) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are "CivicPulse AI", an intelligent, helpful, and empathetic civic assistant for the CivicPulse Smart Civic Complaint Monitoring system in Karnataka.
You help citizens report civic issues (like potholes, light failures, sewerage, garbage), suggest descriptive headlines or complaint improvements, explain priorities, and give system guidance.
Keep responses concise, friendly, and under 3-4 sentences. Format output in Markdown.

User Message: ${message}`
              }]
            }]
          })
        });

        const data = await response.json();
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
          const text = data.candidates[0].content.parts[0].text;
          return res.status(200).json({ success: true, response: text });
        }
      } catch (geminiError) {
        console.error('Gemini API call failed, falling back to rules:', geminiError.message);
      }
    }

    // 3. Fallback / Rule-based intelligent responses
    const msgLower = message.toLowerCase();
    let reply = "";

    if (msgLower.includes('how') && (msgLower.includes('report') || msgLower.includes('complaint') || msgLower.includes('submit'))) {
      reply = "📝 **How to report a civic issue on CivicPulse:**\n\n1. Sign in to your citizen account.\n2. Navigate to **Report Issue** from the sidebar.\n3. Enter the title, select the category, and write a detailed description.\n4. Upload an image (evidence) and pin the location on the map.\n5. Click **Submit Complaint** to register it!";
    } else if (msgLower.includes('pothole') || msgLower.includes('road') || msgLower.includes('footpath')) {
      reply = "🛣️ **Reporting Road Issues:**\n\nFor road damage or potholes, make sure to select the **'Potholes'** or **'Road Damage'** category. To help engineers, describe the size of the pothole and suggest a clear location description like 'near the main market crossing'.";
    } else if (msgLower.includes('priority') || msgLower.includes('urgent') || msgLower.includes('emergency')) {
      reply = "⚡ **CivicPulse Priority Levels:**\n\n• **Emergency**: Sparking wires, tree blocking main roads, heavy floods.\n• **High**: Deep potholes on main roads, sewer line blocks.\n• **Medium**: General road repair, non-functional streetlights.\n• **Low**: Minor cracks, small footpath damage.";
    } else if (msgLower.includes('department') || msgLower.includes('route') || msgLower.includes('assign')) {
      reply = "🏢 **Automatic Department Assignment:**\n\nOur system automatically routes complaints:\n• Water leakage/supply issues → **Water Department**\n• Potholes/road damage → **Road Division**\n• Streetlight failure → **Electrical Department**\n• Drainage blockage → **Sanitation Division**";
    } else if (msgLower.includes('hello') || msgLower.includes('hi') || msgLower.includes('hey')) {
      reply = "👋 **Hello! Welcome to CivicPulse AI.**\n\nI can help you report complaints, suggest better descriptions, track ticket statuses, and answer general civic questions. Try asking 'How do I report a pothole?'";
    } else {
      reply = "🤖 **Thank you for reaching out to CivicPulse AI!**\n\nI can assist you with:\n• Tracking complaints (type your ID like `CIV-XXXXXXXX-XXXX`)\n• Writing better complaint titles/descriptions\n• Explaining automatic priority & department routing\n• Platform user guides.\n\nWhat would you like assistance with?";
    }

    return res.status(200).json({ success: true, response: reply });
  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(500).json({ success: false, message: 'Server error in AI chat assistant' });
  }
};

module.exports = { handleChat };
