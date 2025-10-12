# A11y Annotator Setup Guide

## 🔑 Getting Your OpenAI API Key

### Step 1: Create OpenAI Account
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Complete any required verification

### Step 2: Generate API Key
1. Go to [API Keys page](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Give it a name like "Figma A11y Plugin"
4. Copy the key (starts with `sk-`)
5. **⚠️ Important**: Save it somewhere safe - you won't be able to see it again!

### Step 3: Add Credits
1. Go to [Billing page](https://platform.openai.com/settings/organization/billing/overview)
2. Add payment method and credits
3. **Cost**: ~$0.01-0.05 per focus order generation

## 🚀 Installing the Plugin

### Step 1: Open Figma Desktop
- **Important**: Plugins only work in Figma Desktop, not in browser
- Download from [figma.com/downloads](https://www.figma.com/downloads/)

### Step 2: Import Plugin
1. Open Figma Desktop
2. Go to **Plugins** → **Development** → **Import plugin from manifest**
3. Select the `manifest.json` file from this project
4. The plugin will appear in your plugins menu

### Step 3: Configure API Key
1. Run the plugin: **Plugins** → **A11y Annotator - Focus Order**
2. Paste your API key in the "OpenAI API Key" field
3. Click "🔗 Test Connection" to verify it works
4. The key is automatically saved for future use

## 🎯 Using the Plugin

### Basic Workflow
1. **Select a Frame**: Choose any frame, component, or instance
2. **Generate Focus Order**: Click "🧠 Propose Focus Order"
   - Uses heuristics (free) + AI (with API key)
   - Falls back to heuristics if AI fails
3. **Review & Edit**: Use drag-and-drop to reorder items
4. **Annotate**: Click "📋 Paste with Annotations" for visual chips
5. **Export**: Generate JSON/Markdown for your engineering team

### Platform Toggle
- **Web (ARIA)**: For web accessibility with ARIA attributes
- **React Native**: For mobile apps with accessibility props

## 💰 Cost Breakdown

### OpenAI API Costs (GPT-4 Vision)
- **Image Analysis**: ~$0.01-0.02 per frame
- **Token Usage**: ~$0.001-0.003 per request
- **Total per frame**: ~$0.01-0.05

### Example Usage Costs
- **10 frames/day**: ~$0.10-0.50/day
- **50 frames/week**: ~$0.50-2.50/week
- **200 frames/month**: ~$2-10/month

## 🔒 Security & Privacy

### Data Handling
- **Images**: Sent to OpenAI for analysis (not stored)
- **API Keys**: Stored locally in Figma client storage
- **Specs**: Saved on frames as plugin data
- **No external storage**: Everything stays in your Figma file

### Best Practices
- Use separate API keys for different projects
- Monitor usage in OpenAI dashboard
- Revoke keys if compromised
- Consider team API keys for shared projects

## 🛠️ Troubleshooting

### Common Issues

**"API key is invalid"**
- Check key starts with `sk-`
- Verify you have credits in OpenAI account
- Try regenerating the key

**"No response from OpenAI"**
- Check internet connection
- Verify API key has GPT-4 Vision access
- Try again - sometimes API is slow

**"Failed to generate focus order"**
- Plugin falls back to heuristics (still works!)
- Check console for detailed error messages
- Ensure frame has interactive elements

**"Plugin not working"**
- Make sure you're using Figma Desktop (not browser)
- Restart Figma if needed
- Check plugin permissions in manifest

### Getting Help
- Check browser console for error messages
- Verify API key in OpenAI dashboard
- Test with simple frames first
- Contact support with specific error messages

## 📊 Performance Tips

### For Better Results
- Use clear, well-structured designs
- Name interactive elements descriptively
- Avoid overly complex nested structures
- Test with simple frames first

### Cost Optimization
- Use heuristics-only mode for simple frames
- Batch similar frames together
- Review AI suggestions before accepting
- Use manual editing to reduce re-runs

## 🔄 Updates & Maintenance

### Plugin Updates
- Re-import manifest when updating
- Check for new features in README
- Backup important specs before updating

### API Key Management
- Rotate keys periodically
- Monitor usage in OpenAI dashboard
- Set usage limits if needed
- Keep keys secure and private

---

**Ready to start?** Open Figma Desktop, import the plugin, add your API key, and select your first frame! 🚀

