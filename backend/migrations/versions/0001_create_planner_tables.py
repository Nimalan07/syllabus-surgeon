"""create planner tables

Revision ID: 0001_create_planner_tables
Revises: 
Create Date: 2026-09-08 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0001_create_planner_tables'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=150), nullable=True),
        sa.Column('hashed_password', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. workspaces
    op.create_table(
        'workspaces',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=150), server_default='My Study Workspace', nullable=False),
        sa.Column('target_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workspaces_user_id'), 'workspaces', ['user_id'], unique=False)

    # 3. courses
    op.create_table(
        'courses',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('workspace_id', sa.Uuid(), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_courses_workspace_id'), 'courses', ['workspace_id'], unique=False)

    # 4. assessments
    op.create_table(
        'assessments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('course_id', sa.Uuid(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('assessment_type', sa.String(length=50), server_default='other', nullable=False),
        sa.Column('official_due_date', sa.Date(), nullable=True),
        sa.Column('target_date', sa.Date(), nullable=True),
        sa.Column('priority', sa.String(length=30), server_default='medium', nullable=False),
        sa.Column('status', sa.String(length=30), server_default='not_started', nullable=False),
        sa.Column('estimated_hours', sa.Numeric(precision=6, scale=2), server_default='1', nullable=False),
        sa.Column('completed_hours', sa.Numeric(precision=6, scale=2), server_default='0', nullable=False),
        sa.Column('difficulty', sa.String(length=30), nullable=True),
        sa.Column('impact', sa.String(length=30), nullable=True),
        sa.Column('weight_percent', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('topic', sa.Text(), nullable=True),
        sa.Column('recommended_action', sa.Text(), nullable=True),
        sa.Column('why_prioritized', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_assessments_course_id'), 'assessments', ['course_id'], unique=False)

    # 5. study_sessions
    op.create_table(
        'study_sessions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('workspace_id', sa.Uuid(), nullable=False),
        sa.Column('assessment_id', sa.Uuid(), nullable=True),
        sa.Column('session_date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=True),
        sa.Column('end_time', sa.Time(), nullable=True),
        sa.Column('planned_minutes', sa.Integer(), server_default='30', nullable=False),
        sa.Column('completed_minutes', sa.Integer(), server_default='0', nullable=False),
        sa.Column('status', sa.String(length=30), server_default='planned', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['assessment_id'], ['assessments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_study_sessions_workspace_id'), 'study_sessions', ['workspace_id'], unique=False)


def downgrade() -> None:
    op.drop_table('study_sessions')
    op.drop_table('assessments')
    op.drop_table('courses')
    op.drop_table('workspaces')
    op.drop_table('users')
