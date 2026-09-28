"""Exams URL configuration."""

from django.urls import path
from .views import (
    StudentExamListView,
    StudentExamDetailView,
    AdminExamListCreateView,
    AdminExamDetailView,
    AdminQuestionListCreateView,
    AdminQuestionDetailView,
    AdminTestCaseListCreateView,
    AdminTestCaseDetailView,
    AdminEnrollStudentsView,
    AdminEnrollmentListView,
    AdminExamResultsView,
)

urlpatterns = [
    # Student
    path("my/", StudentExamListView.as_view(), name="student-exam-list"),
    path("<int:pk>/detail/", StudentExamDetailView.as_view(), name="student-exam-detail"),

    # Admin — exam CRUD
    path("", AdminExamListCreateView.as_view(), name="admin-exam-list-create"),
    path("<int:pk>/", AdminExamDetailView.as_view(), name="admin-exam-detail"),

    # Admin — questions
    path("<int:exam_id>/questions/", AdminQuestionListCreateView.as_view(), name="admin-question-list-create"),
    path("<int:exam_id>/questions/<int:pk>/", AdminQuestionDetailView.as_view(), name="admin-question-detail"),

    # Admin — test cases
    path("<int:exam_id>/questions/<int:question_id>/testcases/", AdminTestCaseListCreateView.as_view(), name="admin-tc-list-create"),
    path("<int:exam_id>/questions/<int:question_id>/testcases/<int:pk>/", AdminTestCaseDetailView.as_view(), name="admin-tc-detail"),

    # Admin — enrollment & results
    path("<int:exam_id>/enroll/", AdminEnrollStudentsView.as_view(), name="admin-enroll"),
    path("<int:exam_id>/enrollments/", AdminEnrollmentListView.as_view(), name="admin-enrollments"),
    path("<int:exam_id>/results/", AdminExamResultsView.as_view(), name="admin-results"),
]
