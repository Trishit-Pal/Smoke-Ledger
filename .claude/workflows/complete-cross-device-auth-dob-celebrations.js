export const meta = {
  name: 'complete-cross-device-auth-dob-celebrations',
  description: 'Complete the implementation of cross-device authentication and DOB celebrations',
  phases: [
    { title: 'Understand', detail: 'Analyze current implementation state and identify gaps' },
    { title: 'Plan', detail: 'Create a detailed implementation plan for remaining work' },
    { title: 'Implement', detail: 'Execute implementation tasks' },
    { title: 'Review & Verify', detail: 'Security and quality review' },
  ],
}

phase('Understand')
const analysis = await agent('Analyze the current state of "cross-device auth" and "DOB celebrations". Look at app/(auth)/signup.tsx, the recent git history, and any related components. Identify what is implemented, what is partially implemented, and what is missing based on the feature name. Focus on: 1. Cross-device auth (email links/verification), 2. DOB celebrations (logic, UI, animations).', {
  agentType: 'feature-dev:code-explorer',
  schema: {
    type: 'object',
    properties: {
      implemented: { type: 'array', items: { type: 'string' } },
      partial: { type: 'array', items: { type: 'string' } },
      missing: { type: 'array', items: { type: 'string' } },
      critical_gaps: { type: 'string' },
      relevant_files: { type: 'array', items: { type: 'string' } }
    },
    required: ['implemented', 'partial', 'missing']
  }
})

log(`Analysis complete. Found ${analysis.missing.length} missing items.`)

phase('Plan')
const plan = await agent(`Based on this analysis: ${JSON.stringify(analysis)}, create a detailed implementation plan to finish the "cross-device auth" and "DOB celebrations" features. The plan should be a list of concrete tasks, including specific files to create or modify, and the expected behavior for each.`, {
  agentType: 'Plan',
  schema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            subject: { type: 'string' },
            description: { type: 'string' },
            files: { type: 'array', items: { type: 'string' } },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] }
          },
          required: ['id', 'subject', 'description']
        }
      },
      risks: { type: 'array', items: { type: 'string' } }
    },
    required: ['tasks']
  }
})

log(`Plan created with ${plan.tasks.length} tasks.`)

phase('Implement')
// We use a pipeline to implement tasks sequentially or in parallel where possible
// Since we are in "ultracode", we want maximum thoroughness.
const implementationResults = await pipeline(
  plan.tasks,
  async (task) => {
    return await agent(`Implement this task: ${task.subject}. ${task.description}. Affected files: ${task.files?.join(', ') || 'unknown'}. Ensure you follow the project's coding style (immutability, small functions, etc.) and handle errors explicitly.`, {
      label: `impl:${task.id}`,
      isolation: 'worktree'
    })
  }
)

phase('Review & Verify')
const securityReview = await agent(`Review the changes made in the implementation phase for security vulnerabilities, especially regarding cross-device auth, email links, and user data handling.`, {
  agentType: 'security-reviewer'
})

const qualityReview = await agent(`Review the changes for code quality, patterns, and adherence to the project's style guide.`, {
  agentType: 'feature-dev:code-reviewer'
})

return {
  analysis,
  plan,
  implementationResults,
  securityReview,
  qualityReview
}
