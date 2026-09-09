# Cấu trúc dự án

```text
internship-management-system/
├── backend/
│   ├── prisma/                 # schema Prisma, migrations, seed
│   ├── src/
│   │   ├── auth/ users/ roles/ permissions/
│   │   ├── students/ companies/ company-supervisors/
│   │   ├── internship-periods/ eligibility/ internship-positions/
│   │   ├── internship-applications/ internships/ learning-agreements/
│   │   ├── faculty-assignments/ attendance/ weekly-reports/ progress/
│   │   ├── evaluations/ evaluation-criteria/ grading-policies/ final-reports/
│   │   ├── documents/ notifications/ audit-logs/ lookups/ health/
│   │   └── common/              # guards, decorators, filters, pipes, helpers
│   └── test/
├── frontend/
│   └── src/
│       ├── app/                 # routes theo domain và role
│       ├── components/ features/ lib/ hooks/ types/
├── shared/                      # contracts chỉ dùng chung khi thực sự cần
├── docs/                        # tài liệu thiết kế và vận hành
├── infra/nginx/                 # reverse proxy
└── docker-compose.yml
```

Mỗi backend domain là một NestJS module độc lập, đặt controller, service, DTO, policy/guard và test của chính nó trong cùng domain. Không đặt business rule quan trọng trong controller hoặc frontend.
