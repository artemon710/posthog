import { IconInfo, IconPlus } from '@posthog/icons'
import { LemonBanner, LemonCheckbox, LemonDialog, LemonTextArea } from '@posthog/lemon-ui'
import { useActions, useValues } from 'kea'
import { Form } from 'kea-forms'
import { router } from 'kea-router'
import { EditableField } from 'lib/components/EditableField/EditableField'
import { ObjectTags } from 'lib/components/ObjectTags/ObjectTags'
import { PageHeader } from 'lib/components/PageHeader'
import { FEATURE_FLAGS } from 'lib/constants'
import { IconPlayCircle } from 'lib/lemon-ui/icons'
import { LemonButton } from 'lib/lemon-ui/LemonButton'
import { LemonField } from 'lib/lemon-ui/LemonField'
import { LemonLabel } from 'lib/lemon-ui/LemonLabel/LemonLabel'
import { Link } from 'lib/lemon-ui/Link'
import { featureFlagLogic } from 'lib/logic/featureFlagLogic'
import { ActionHogFunctions } from 'scenes/actions/ActionHogFunctions'
import { pipelineAccessLogic } from 'scenes/pipeline/pipelineAccessLogic'
import { teamLogic } from 'scenes/teamLogic'
import { urls } from 'scenes/urls'

import { tagsModel } from '~/models/tagsModel'
import { ActionStepType, FilterLogicalOperator, ReplayTabs } from '~/types'

import { actionEditLogic, ActionEditLogicProps, DEFAULT_ACTION_STEP } from './actionEditLogic'
import { ActionStep } from './ActionStep'

export function ActionEdit({ action: loadedAction, id }: ActionEditLogicProps): JSX.Element {
    const logicProps: ActionEditLogicProps = {
        id: id,
        action: loadedAction,
    }
    const logic = actionEditLogic(logicProps)
    const { action, actionLoading, actionChanged, migrationLoading, hasCohortFilters } = useValues(logic)
    const { submitAction, deleteAction, migrateToHogFunction } = useActions(logic)
    const { currentTeam } = useValues(teamLogic)
    const { tags } = useValues(tagsModel)
    const { canEnableNewDestinations: hasDataPipelinesAddon } = useValues(pipelineAccessLogic)
    const { featureFlags } = useValues(featureFlagLogic)

    const slackEnabled = currentTeam?.slack_incoming_webhook
    const showWebhookDelivery =
        (!hasDataPipelinesAddon && slackEnabled) ||
        action.post_to_slack ||
        featureFlags[FEATURE_FLAGS.LEGACY_ACTION_WEBHOOKS]
    const showActionMigrationBanner = hasDataPipelinesAddon && action.post_to_slack

    const deleteButton = (): JSX.Element => (
        <LemonButton
            data-attr="delete-action-bottom"
            status="danger"
            type="secondary"
            onClick={() => {
                deleteAction()
            }}
        >
            Delete
        </LemonButton>
    )

    const cancelButton = (): JSX.Element => (
        <LemonButton
            data-attr="cancel-action-bottom"
            status="danger"
            type="secondary"
            onClick={() => {
                router.actions.push(urls.actions())
            }}
        >
            Cancel
        </LemonButton>
    )

    const actionEditJSX = (
        <div className="action-edit-container">
            <Form logic={actionEditLogic} props={logicProps} formKey="action" enableFormOnSubmit>
                <PageHeader
                    caption={
                        <>
                            <LemonField name="description">
                                {({ value, onChange }) => (
                                    <EditableField
                                        multiline
                                        name="description"
                                        markdown
                                        value={value || ''}
                                        placeholder="Description (optional)"
                                        onChange={
                                            !id
                                                ? onChange
                                                : undefined /* When creating a new action, change value on type */
                                        }
                                        onSave={(value) => {
                                            onChange(value)
                                            submitAction()
                                            /* When clicking 'Set' on an `EditableField`, always save the form */
                                        }}
                                        mode={
                                            !id
                                                ? 'edit'
                                                : undefined /* When creating a new action, maintain edit mode */
                                        }
                                        data-attr="action-description"
                                        className="action-description"
                                        compactButtons
                                        maxLength={600} // No limit on backend model, but enforce shortish description
                                    />
                                )}
                            </LemonField>
                            <LemonField name="tags" className="mt-2">
                                {({ value, onChange }) => (
                                    <ObjectTags
                                        tags={value ?? []}
                                        onChange={(tags) => onChange(tags)}
                                        className="action-tags"
                                        saving={actionLoading}
                                        tagsAvailable={tags.filter((tag) => !action.tags?.includes(tag))}
                                    />
                                )}
                            </LemonField>
                        </>
                    }
                    buttons={
                        <>
                            {id ? (
                                <LemonButton
                                    type="secondary"
                                    to={urls.replay(ReplayTabs.Home, {
                                        filter_group: {
                                            type: FilterLogicalOperator.And,
                                            values: [
                                                {
                                                    type: FilterLogicalOperator.And,
                                                    values: [
                                                        {
                                                            id: id,
                                                            type: 'actions',
                                                            order: 0,
                                                            name: action.name,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    })}
                                    sideIcon={<IconPlayCircle />}
                                    data-attr="action-view-recordings"
                                >
                                    View recordings
                                </LemonButton>
                            ) : null}
                            {id ? deleteButton() : cancelButton()}
                            {actionChanged || !id ? (
                                <LemonButton
                                    data-attr="save-action-button"
                                    type="primary"
                                    htmlType="submit"
                                    loading={actionLoading}
                                    onClick={submitAction}
                                    disabledReason={!actionChanged && !id ? 'No changes to save' : undefined}
                                >
                                    Save
                                </LemonButton>
                            ) : null}
                        </>
                    }
                />

                <div className="@container">
                    <h2 className="subtitle">Match groups</h2>
                    <p>
                        Your action will be triggered whenever <b>any of your match groups</b> are received.
                        <Link to="https://posthog.com/docs/features/actions" target="_blank">
                            <IconInfo className="ml-1 text-muted text-xl" />
                        </Link>
                    </p>
                    <LemonField name="steps">
                        {({ value: stepsValue, onChange }) => (
                            <div className="grid @4xl:grid-cols-2 gap-3">
                                {stepsValue.map((step: ActionStepType, index: number) => {
                                    const identifier = String(JSON.stringify(step))
                                    return (
                                        <ActionStep
                                            key={index}
                                            identifier={identifier}
                                            index={index}
                                            step={step}
                                            actionId={action.id || 0}
                                            isOnlyStep={!!stepsValue && stepsValue.length === 1}
                                            onDelete={() => {
                                                const newSteps = [...stepsValue]
                                                newSteps.splice(index, 1)
                                                onChange(newSteps)
                                            }}
                                            onChange={(newStep) => {
                                                const newSteps = [...stepsValue]
                                                newSteps.splice(index, 1, newStep)
                                                onChange(newSteps)
                                            }}
                                        />
                                    )
                                })}

                                <div>
                                    <LemonButton
                                        icon={<IconPlus />}
                                        type="secondary"
                                        onClick={() => {
                                            onChange([...(action.steps || []), DEFAULT_ACTION_STEP])
                                        }}
                                        center
                                        className="w-full h-full"
                                    >
                                        Add match group
                                    </LemonButton>
                                </div>
                            </div>
                        )}
                    </LemonField>
                </div>

                {showWebhookDelivery ? (
                    <div className="my-4 space-y-2">
                        <h2 className="subtitle">Webhook delivery</h2>

                        {showActionMigrationBanner ? (
                            <LemonBanner
                                type="error"
                                action={{
                                    children: 'Upgrade to new version',
                                    onClick: () =>
                                        LemonDialog.open({
                                            title: 'Upgrade webhook',
                                            width: '30rem',
                                            description:
                                                'This will create a new Destination in the upgraded system. The action will have its webhook disabled. There will be slight difference in the placeholder tags, so double check that everything works as expected.',
                                            secondaryButton: {
                                                type: 'secondary',
                                                children: 'Cancel',
                                            },
                                            primaryButton: {
                                                type: 'primary',
                                                onClick: () => migrateToHogFunction(),
                                                children: 'Upgrade',
                                            },
                                        }),
                                    disabledReason: hasCohortFilters
                                        ? 'Can not upgrade because action has a cohort filter.'
                                        : migrationLoading
                                        ? 'Loading...'
                                        : actionChanged
                                        ? 'Please save the action first'
                                        : undefined,
                                }}
                            >
                                Action Webhooks have been replaced by the new and improved <b>Pipeline Destinations</b>.{' '}
                                {!hasCohortFilters && !actionChanged ? 'Click to upgrade.' : ''}
                            </LemonBanner>
                        ) : null}

                        <LemonField name="post_to_slack">
                            {({ value, onChange }) => (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <LemonCheckbox
                                        id="webhook-checkbox"
                                        bordered
                                        checked={!!value}
                                        onChange={onChange}
                                        disabledReason={!slackEnabled ? 'Configure webhooks in project settings' : null}
                                        label={
                                            <>
                                                <span>Post to webhook when this action is triggered.</span>
                                            </>
                                        }
                                    />
                                    <Link to={urls.settings('project-integrations', 'integration-webhooks')}>
                                        {slackEnabled ? 'Configure' : 'Enable'} webhooks in project settings.
                                    </Link>
                                </div>
                            )}
                        </LemonField>
                        {action.post_to_slack && (
                            <LemonField name="slack_message_format">
                                {({ value, onChange }) => (
                                    <>
                                        <LemonLabel showOptional>Slack message format</LemonLabel>
                                        <LemonTextArea
                                            placeholder="Default: [action.name] triggered by [person]"
                                            value={value}
                                            onChange={onChange}
                                            disabled={!slackEnabled || !action.post_to_slack}
                                            data-attr="edit-slack-message-format"
                                            maxLength={1200 /** Must be same as in posthog/models/action/action.py */}
                                        />
                                        <small>
                                            <Link
                                                to="https://posthog.com/docs/webhooks#message-formatting"
                                                target="_blank"
                                            >
                                                See documentation on how to format webhook messages.
                                            </Link>
                                        </small>
                                    </>
                                )}
                            </LemonField>
                        )}
                    </div>
                ) : null}
            </Form>
        </div>
    )

    return (
        <>
            {actionEditJSX}
            <ActionHogFunctions />
        </>
    )
}
