FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY services/api/HospitalVisitApi.csproj services/api/packages.lock.json ./
RUN dotnet restore --locked-mode
COPY services/api/ ./
RUN dotnet publish --no-restore -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:9.0
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl && mkdir -p /data && chown app:app /data
WORKDIR /app
COPY --from=build /out ./
ENV ASPNETCORE_URLS=http://+:8080
ENV ConnectionStrings__DefaultConnection="Data Source=/data/hospital.db"
USER app
EXPOSE 8080
ENTRYPOINT ["dotnet", "HospitalVisitApi.dll"]
